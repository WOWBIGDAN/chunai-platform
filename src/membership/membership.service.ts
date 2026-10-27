import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { ApiException } from '../common/http';
import { PageDto } from '../auth/auth.dto';
import { User } from '../database/entities';
import { Actor, actorId, checkVersion, CommerceTransaction, conflict, missing, page, touch } from '../commerce/transaction';
import { MembershipEntitlement, UserMembership } from './entities';
import { MembershipRevokeDto, MembershipSaveDto } from './membership.dto';
import { membershipSummary } from './membership-access';
import { assertManualMembershipWritable } from './membership-purchase';
import { deliverMessage } from '../messages/delivery';

@Injectable()
export class MembershipService {
  constructor(private readonly db: DataSource, private readonly tx: CommerceTransaction) {}

  private async detail(m: EntityManager, userId: string) {
    const record = await m.findOneBy(UserMembership, { userId });
    return { ...await membershipSummary(m, userId), membership: record ? {
      id: record.id, userId: record.userId, startsAt: record.startsAt.toISOString(), expiresAt: record.expiresAt.toISOString(),
      revokedAt: record.revokedAt?.toISOString() ?? null, version: record.version,
    } : null };
  }

  mine(userId: string) { return this.db.transaction('REPEATABLE READ', m => this.detail(m, userId)); }

  private async periodList(m: EntityManager, userId: string, query: PageDto) {
    const [items, total] = await m.getRepository(MembershipEntitlement).createQueryBuilder('p')
      .where('p.userId = :userId', { userId }).orderBy('p.createdAt', 'DESC').addOrderBy('p.id', 'ASC')
      .skip((query.page - 1) * query.pageSize).take(query.pageSize).getManyAndCount();
    return page(items, total, query);
  }

  myPeriods(userId: string, query: PageDto) {
    return this.db.transaction('REPEATABLE READ', m => this.periodList(m, userId, query));
  }

  periods(actor: Actor, userId: string, query: PageDto) {
    return this.tx.run(actor, async m => {
      if (!await m.existsBy(User, { id: userId })) throw missing();
      await this.tx.audit(m, actor, 'membership-periods.read', userId);
      return this.periodList(m, userId, query);
    });
  }

  get(actor: Actor, userId: string) {
    return this.tx.run(actor, async m => {
      if (!await m.existsBy(User, { id: userId })) throw missing();
      await this.tx.audit(m, actor, 'membership.read', userId);
      return this.detail(m, userId);
    });
  }

  save(actor: Actor, userId: string, dto: MembershipSaveDto) {
    const startsAt = new Date(dto.startsAt); const expiresAt = new Date(dto.expiresAt);
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(expiresAt.getTime()) ||
      startsAt.getUTCFullYear() < 1000 || expiresAt.getUTCFullYear() > 9999 ||
      startsAt.getTime() >= expiresAt.getTime() || expiresAt.getTime() <= Date.now()) {
      throw new ApiException(400, 'MEMBERSHIP_TERM_INVALID', '会员开始时间必须早于到期时间，到期时间必须晚于当前时间');
    }
    return this.tx.run(actor, async m => {
      // Lock a stable parent row to serialize first grants as well as renewals/revocations.
      const user = await m.findOne(User, { where: { id: userId }, lock: { mode: 'pessimistic_write' } });
      if (!user) throw missing();
      if (user.status !== 'ACTIVE') throw new ApiException(409, 'ACCOUNT_UNAVAILABLE', '账号当前不可开通会员');
      await assertManualMembershipWritable(m, userId);
      const existing = await m.findOne(UserMembership, { where: { userId }, lock: { mode: 'pessimistic_write' } });
      if (existing) checkVersion(existing, dto.version);
      else if (dto.version !== 0) conflict('VERSION_CONFLICT', '会员记录不存在，首次开通请使用 version=0');
      const notificationTitle = !existing || existing.revokedAt ? '会员权益已开通'
        : expiresAt.getTime() > existing.expiresAt.getTime() ? '会员有效期已延长' : '会员有效期已调整';
      const record = existing ?? m.create(UserMembership, { id: randomUUID(), userId, version: 1 });
      record.startsAt = startsAt; record.expiresAt = expiresAt; record.revokedAt = null;
      record.reason = dto.reason.trim(); record.operatorId = actorId(actor);
      if (existing) touch(record);
      await m.save(record);
      await this.tx.audit(m, actor, existing ? 'membership.update' : 'membership.grant', userId,
        { membershipId: record.id, version: record.version, startsAt: startsAt.toISOString(), expiresAt: expiresAt.toISOString(), reason: record.reason });
      await deliverMessage(m, { userId, eventKey: `membership:${record.id}:saved:${record.version}`, category: 'MEMBERSHIP',
        title: notificationTitle, body: '管理员已更新会员权益，请在会员中心查看生效时间及有效期。',
        resourceType: 'MEMBERSHIP', resourceId: userId });
      return this.detail(m, userId);
    });
  }

  revoke(actor: Actor, userId: string, dto: MembershipRevokeDto) {
    return this.tx.run(actor, async m => {
      const user = await m.findOne(User, { where: { id: userId }, lock: { mode: 'pessimistic_write' } });
      if (!user) throw missing();
      await assertManualMembershipWritable(m, userId);
      const record = await m.findOne(UserMembership, { where: { userId }, lock: { mode: 'pessimistic_write' } });
      if (!record) throw missing();
      checkVersion(record, dto.version);
      if (record.revokedAt) conflict('MEMBERSHIP_ALREADY_REVOKED', '会员资格已撤销');
      record.revokedAt = new Date(); record.reason = dto.reason.trim(); record.operatorId = actorId(actor); touch(record);
      await m.save(record);
      await this.tx.audit(m, actor, 'membership.revoke', userId,
        { membershipId: record.id, version: record.version, reason: record.reason });
      await deliverMessage(m, { userId, eventKey: `membership:${record.id}:revoked:${record.version}`, category: 'MEMBERSHIP',
        title: '管理员开通的会员权益已撤销', body: '管理员开通的会员权益已撤销，当前会员资格请在会员中心查看。',
        resourceType: 'MEMBERSHIP', resourceId: userId });
      return this.detail(m, userId);
    });
  }
}
