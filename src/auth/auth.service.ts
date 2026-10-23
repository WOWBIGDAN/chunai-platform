import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DataSource, EntityManager, IsNull, MoreThan, QueryFailedError } from 'typeorm';
import { authConfig } from '../config';
import { ApiException, Principal } from '../common/http';
import { AuthSession, RefreshToken, User } from '../database/entities';
import { PageDto, PasswordChangeDto, PasswordLoginDto, RegisterDto } from './auth.dto';
import { PasswordService } from './password.service';

const invalidToken = () => new ApiException(401, 'TOKEN_INVALID', '登录凭证无效，请重新登录');
const invalidCredentials = () => new ApiException(401, 'AUTH_INVALID_CREDENTIALS', '手机号或密码错误');
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  private readonly config = authConfig();

  constructor(private readonly db: DataSource, private readonly passwords: PasswordService,
    private readonly jwt: JwtService) {}

  userSummary(user: User) {
    const phone = user.phone.startsWith('+86') ? user.phone.slice(3) : user.phone;
    return {
      id: user.id, nickname: user.nickname, avatarUrl: null,
      phoneMasked: `${phone.slice(0, 3)}****${phone.slice(-4)}`,
      status: user.status,
      // Membership and media are separate modules, not implemented in this phase.
      membership: { active: false, expiresAt: null, benefitCodes: [] },
      createdAt: user.createdAt.toISOString(),
    };
  }

  private async issueTokens(manager: EntityManager, user: User, session: AuthSession) {
    const refreshToken = randomBytes(48).toString('base64url');
    await manager.insert(RefreshToken, {
      id: randomUUID(), sessionId: session.id, tokenHash: tokenHash(refreshToken), usedAt: null,
    });
    const accessToken = await this.jwt.signAsync({ sid: session.id }, {
      secret: this.config.secret, algorithm: 'HS256', issuer: this.config.issuer,
      audience: 'client', subject: user.id, jwtid: randomUUID(), expiresIn: this.config.accessTtl,
    });
    return {
      accessToken, accessExpiresInSeconds: this.config.accessTtl,
      refreshToken, refreshExpiresAt: session.expiresAt.toISOString(), tokenType: 'Bearer',
      user: this.userSummary(user),
    };
  }

  private async createSession(manager: EntityManager, user: User, userAgent: string) {
    const session = manager.create(AuthSession, {
      id: randomUUID(), userId: user.id,
      deviceLabel: userAgent.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 255) || 'Unknown device',
      expiresAt: new Date(Date.now() + this.config.refreshDays * 86400000),
      lastActiveAt: new Date(), revokedAt: null,
    });
    await manager.save(session);
    return this.issueTokens(manager, user, session);
  }

  async register(dto: RegisterDto, userAgent: string) {
    if (dto.termsVersion !== this.config.termsVersion || dto.privacyVersion !== this.config.privacyVersion) {
      throw new ApiException(409, 'PROTOCOL_VERSION_CHANGED', '协议已更新，请阅读并同意当前版本');
    }
    const passwordHash = await this.passwords.hash(dto.password);
    try {
      return await this.db.transaction(async (manager) => {
        const user = manager.create(User, {
          id: randomUUID(), phone: dto.phone, passwordHash,
          nickname: dto.nickname?.trim() ?? '新用户', status: 'ACTIVE', phoneVerifiedAt: null,
          termsVersion: dto.termsVersion, privacyVersion: dto.privacyVersion,
          consentedAt: new Date(), passwordChangedAt: null, lastLoginAt: new Date(),
        });
        await manager.save(user);
        return this.createSession(manager, user, userAgent);
      });
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new ApiException(409, 'PHONE_ALREADY_REGISTERED', '该手机号已注册，请登录');
      }
      throw error;
    }
  }

  async login(dto: PasswordLoginDto, userAgent: string) {
    const candidate = await this.db.getRepository(User).createQueryBuilder('user')
      .addSelect('user.passwordHash').where('user.phone = :phone', { phone: dto.phone }).getOne();
    const valid = await this.passwords.verify(dto.password, candidate?.passwordHash);
    if (!candidate || !valid) throw invalidCredentials();
    const result = await this.db.transaction(async (manager) => {
      const user = await this.lockUser(manager, candidate.id);
      if (!user || user.passwordHash !== candidate.passwordHash) return { error: invalidCredentials() };
      if (user.status !== 'ACTIVE') {
        await this.revokeAll(manager, user.id);
        return { error: new ApiException(403, 'ACCOUNT_BANNED', '账号当前不可用') };
      }
      await manager.update(User, user.id, { lastLoginAt: new Date(), updatedAt: new Date() });
      return { data: await this.createSession(manager, user, userAgent) };
    });
    if (result.error) throw result.error;
    return result.data;
  }

  async refresh(rawToken: string) {
    const candidate = await this.db.getRepository(RefreshToken).findOneBy({ tokenHash: tokenHash(rawToken) });
    if (!candidate) throw invalidToken();
    const candidateSession = await this.db.getRepository(AuthSession).findOneBy({ id: candidate.sessionId });
    if (!candidateSession) throw invalidToken();
    // Lock order for all session mutations: user -> session -> token.
    // Return errors from the transaction so replay revocation COMMITS before throwing.
    const result = await this.db.transaction(async (manager) => {
      const user = await this.lockUser(manager, candidateSession.userId);
      const session = await manager.findOne(AuthSession, {
        where: { id: candidateSession.id }, lock: { mode: 'pessimistic_write' },
      });
      if (!user || !session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
        return { error: invalidToken() };
      }
      if (user.status !== 'ACTIVE') {
        await this.revokeAll(manager, user.id);
        return { error: invalidToken() };
      }
      const token = await manager.findOne(RefreshToken, {
        where: { id: candidate.id }, lock: { mode: 'pessimistic_write' },
      });
      if (!token) return { error: invalidToken() };
      if (token.usedAt) {
        await manager.update(AuthSession, session.id, { revokedAt: new Date() });
        return { error: new ApiException(401, 'REFRESH_TOKEN_REUSED', '刷新令牌已使用，请重新登录') };
      }
      await manager.update(RefreshToken, token.id, { usedAt: new Date() });
      await manager.update(AuthSession, session.id, { lastActiveAt: new Date() });
      return { data: await this.issueTokens(manager, user, session) };
    });
    if (result.error) throw result.error;
    return result.data;
  }

  async authenticate(authorization?: string): Promise<Principal> {
    const match = /^Bearer ([A-Za-z0-9_.-]+)$/i.exec(authorization ?? '');
    if (!authorization) throw new ApiException(401, 'AUTH_REQUIRED', '请先登录');
    if (!match) throw invalidToken();
    let claims: { sub?: unknown; sid?: unknown; exp?: unknown };
    try {
      claims = await this.jwt.verifyAsync(match[1], {
        secret: this.config.secret, algorithms: ['HS256'], issuer: this.config.issuer, audience: 'client',
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        throw new ApiException(401, 'TOKEN_EXPIRED', '访问令牌已过期');
      }
      throw invalidToken();
    }
    if (typeof claims.sub !== 'string' || typeof claims.sid !== 'string' || typeof claims.exp !== 'number') {
      throw invalidToken();
    }
    const session = await this.db.getRepository(AuthSession).findOneBy({ id: claims.sid, userId: claims.sub });
    const user = await this.db.getRepository(User).findOneBy({ id: claims.sub });
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now() || !user) throw invalidToken();
    if (user.status !== 'ACTIVE') {
      await this.db.transaction(async (manager) => {
        const locked = await this.lockUser(manager, user.id);
        if (locked && locked.status !== 'ACTIVE') await this.revokeAll(manager, user.id);
      });
      throw invalidToken();
    }
    await this.db.getRepository(AuthSession).update(session.id, { lastActiveAt: new Date() });
    return { user, sessionId: session.id };
  }

  private lockUser(manager: EntityManager, id: string) {
    return manager.getRepository(User).createQueryBuilder('user').addSelect('user.passwordHash')
      .where('user.id = :id', { id }).setLock('pessimistic_write').getOne();
  }

  private revokeAll(manager: EntityManager, userId: string) {
    return manager.update(AuthSession, { userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  private async assertActiveSession(manager: EntityManager, principal: Principal) {
    const session = await manager.findOne(AuthSession, {
      where: { id: principal.sessionId, userId: principal.user.id }, lock: { mode: 'pessimistic_write' },
    });
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) throw invalidToken();
  }

  async changePassword(principal: Principal, dto: PasswordChangeDto) {
    await this.db.transaction(async (manager) => {
      const user = await this.lockUser(manager, principal.user.id);
      if (!user || user.status !== 'ACTIVE') throw invalidToken();
      await this.assertActiveSession(manager, principal);
      if (!await this.passwords.verify(dto.currentPassword, user.passwordHash)) throw invalidCredentials();
      await manager.update(User, user.id, {
        passwordHash: await this.passwords.hash(dto.newPassword), passwordChangedAt: new Date(), updatedAt: new Date(),
      });
      await this.revokeAll(manager, user.id);
    });
    return { success: true };
  }

  async revokeSession(principal: Principal, sessionId: string) {
    await this.db.transaction(async (manager) => {
      const user = await this.lockUser(manager, principal.user.id);
      if (!user || user.status !== 'ACTIVE') throw invalidToken();
      await this.assertActiveSession(manager, principal);
      const target = await manager.findOneBy(AuthSession, { id: sessionId, userId: principal.user.id });
      if (!target) throw new ApiException(404, 'RESOURCE_NOT_FOUND', '会话不存在');
      await manager.update(AuthSession, target.id, { revokedAt: new Date() });
    });
    return { success: true };
  }

  async sessions(principal: Principal, query: PageDto) {
    const [sessions, total] = await this.db.getRepository(AuthSession).findAndCount({
      where: { userId: principal.user.id, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC', id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize,
    });
    return {
      items: sessions.map((session) => ({
        id: session.id, deviceLabel: session.deviceLabel, isCurrent: session.id === principal.sessionId,
        lastActiveAt: session.lastActiveAt.toISOString(), createdAt: session.createdAt.toISOString(),
      })), total, page: query.page, pageSize: query.pageSize, hasNext: query.page * query.pageSize < total,
    };
  }

  legalDocument(type: string) {
    if (type !== 'TERMS' && type !== 'PRIVACY') throw new ApiException(404, 'RESOURCE_NOT_FOUND', '协议不存在');
    return {
      type, version: type === 'TERMS' ? this.config.termsVersion : this.config.privacyVersion,
      contentHtml: type === 'TERMS' ? this.config.termsHtml : this.config.privacyHtml,
      updatedAt: this.config.legalUpdatedAt,
    };
  }
}
