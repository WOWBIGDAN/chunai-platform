import { Injectable } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { ApiException } from '../common/http';
import { Actor, actorId, checkVersion, CommerceTransaction, conflict, missing, page, touch } from '../commerce/transaction';
import { validateContentImageUrl } from '../content/media-source';
import { AuthSession, User } from '../database/entities';
import { activeMembershipSql } from '../membership/membership-access';
import { AdminUserQueryDto, UserModerationDto, UserPatchDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(private readonly tx: CommerceTransaction, private readonly auth: AuthService) {}

  patch(actor: Actor, dto: UserPatchDto) {
    if (dto.nickname === undefined && dto.avatarUrl === undefined) throw new ApiException(400, 'VALIDATION_ERROR', '请至少提供一个资料字段');
    const avatarUrl = dto.avatarUrl ? validateContentImageUrl(dto.avatarUrl, true).publicUrl : dto.avatarUrl;
    if (avatarUrl && avatarUrl.length > 2048) throw new ApiException(400, 'VALIDATION_ERROR', '头像地址编码后不能超过 2048 个字符');
    return this.tx.run(actor, async m => {
      const user = await m.findOne(User, { where: { id: actorId(actor) }, lock: { mode: 'pessimistic_write' } });
      if (!user) throw missing();
      checkVersion(user, dto.version);
      if (dto.nickname !== undefined) user.nickname = dto.nickname;
      if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
      touch(user); await m.save(user);
      return this.auth.userSummary(user, m);
    });
  }

  private query(m: EntityManager) {
    return m.getRepository(User).createQueryBuilder('user').addSelect(['user.bannedReason', 'user.bannedAt']);
  }

  private async summary(m: EntityManager, user: User) {
    return { ...await this.auth.userSummary(user, m), banReason: user.bannedReason ?? null,
      bannedAt: user.bannedAt?.toISOString() ?? null, lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      updatedAt: user.updatedAt.toISOString() };
  }

  list(actor: Actor, q: AdminUserQueryDto) {
    const from = q.createdFrom ? new Date(q.createdFrom) : null, to = q.createdTo ? new Date(q.createdTo) : null;
    if ([from, to].some(date => date && (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 1000 || date.getUTCFullYear() > 9999)) || (from && to && from > to)) {
      throw new ApiException(400, 'VALIDATION_ERROR', '用户创建时间范围无效');
    }
    return this.tx.run(actor, async m => {
      const query = this.query(m);
      // LOCATE treats percent/underscore/backslash as literal nickname text, not SQL patterns.
      if (q.keyword) query.andWhere('LOCATE(:keyword, user.nickname) > 0', { keyword: q.keyword });
      if (q.phone) query.andWhere('user.phone = :phone', { phone: q.phone });
      if (q.status) query.andWhere('user.status = :status', { status: q.status });
      if (from) query.andWhere('user.createdAt >= :createdFrom', { createdFrom: from });
      if (to) query.andWhere('user.createdAt <= :createdTo', { createdTo: to });
      if (q.hasMembership !== undefined) {
        const active = activeMembershipSql('user', 'memberNow');
        query.andWhere(q.hasMembership ? active : `NOT ${active}`, { memberNow: new Date() });
      }
      const [rows, total] = await query.orderBy('user.createdAt', 'DESC').addOrderBy('user.id', 'DESC')
        .skip((q.page - 1) * q.pageSize).take(q.pageSize).getManyAndCount();
      await this.tx.audit(m, actor, 'users.list', 'users', { page: q.page, pageSize: q.pageSize, total,
        status: q.status ?? null, hasMembership: q.hasMembership ?? null, searchedPhone: !!q.phone, searchedNickname: !!q.keyword });
      return page(await Promise.all(rows.map(user => this.summary(m, user))), total, q);
    });
  }

  get(actor: Actor, id: string) {
    return this.tx.run(actor, async m => {
      const user = await this.query(m).where('user.id = :id', { id }).getOne();
      if (!user) throw missing();
      await this.tx.audit(m, actor, 'users.read', id);
      return this.summary(m, user);
    });
  }

  moderate(actor: Actor, id: string, ban: boolean, dto: UserModerationDto, key?: string) {
    const action = ban ? 'users.ban' : 'users.unban';
    return this.tx.run(actor, async m => {
      const user = await this.query(m).where('user.id = :id', { id }).setLock('pessimistic_write').getOne();
      if (!user) throw missing();
      checkVersion(user, dto.version);
      if (user.status !== (ban ? 'ACTIVE' : 'BANNED')) conflict('USER_STATUS_CONFLICT', ban ? '只能封禁正常用户' : '只能解封已封禁用户');
      user.status = ban ? 'BANNED' : 'ACTIVE';
      user.bannedReason = ban ? dto.reason : null; user.bannedAt = ban ? new Date() : null;
      touch(user); await m.save(user);
      // User-row lock serializes login/refresh, password/profile and membership changes with moderation.
      if (ban) await m.update(AuthSession, { userId: user.id, revokedAt: IsNull() }, { revokedAt: new Date() });
      await this.tx.audit(m, actor, action, user.id, { reason: dto.reason, version: user.version });
      return this.summary(m, user);
    }, { key, action: `${action}:${id}`, body: dto });
  }
}
