import { Body, CanActivate, Controller, ExecutionContext, Get, HttpCode, Injectable, Module, Post, Req, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { PasswordService } from '../auth/password.service';
import { RefreshDto } from '../auth/auth.dto';
import { authConfig } from '../config';
import { ApiException, ApiRequest } from '../common/http';
import { AdminAccount, AdminRefreshToken, AdminSession } from './entities';
import { AdminLoginDto } from './commerce.dto';
import { Permission } from './permissions';

export interface AdminPrincipal { account: AdminAccount; sessionId: string }
export interface AdminRequest extends ApiRequest { admin: AdminPrincipal }
export const RequirePermission = (permission: Permission) => SetMetadata('commerce:permission', permission);
const invalid = () => new ApiException(401, 'TOKEN_INVALID', '管理员登录凭证无效');
const digest = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class AdminAuthService {
  private readonly config = authConfig();
  constructor(private readonly db: DataSource, private readonly passwords: PasswordService, private readonly jwt: JwtService) {}
  summary(a: AdminAccount) { return { id: a.id, username: a.username, displayName: a.displayName, permissions: a.permissions }; }
  private lock(m: EntityManager, id: string) {
    return m.getRepository(AdminAccount).createQueryBuilder('a').addSelect('a.passwordHash')
      .where('a.id = :id', { id }).setLock('pessimistic_write').getOne();
  }
  private async tokens(m: EntityManager, account: AdminAccount, session: AdminSession) {
    const refreshToken = randomBytes(48).toString('base64url');
    await m.insert(AdminRefreshToken, { id: randomUUID(), sessionId: session.id, tokenHash: digest(refreshToken), usedAt: null });
    const accessToken = await this.jwt.signAsync({ sid: session.id }, { secret: this.config.secret,
      algorithm: 'HS256', issuer: this.config.issuer, audience: 'admin', subject: account.id,
      jwtid: randomUUID(), expiresIn: this.config.accessTtl });
    return { accessToken, accessExpiresInSeconds: this.config.accessTtl, refreshToken,
      refreshExpiresAt: session.expiresAt.toISOString(), tokenType: 'Bearer', admin: this.summary(account) };
  }
  async login(dto: AdminLoginDto) {
    const candidate = await this.db.getRepository(AdminAccount).createQueryBuilder('a').addSelect('a.passwordHash')
      .where('a.username = :username', { username: dto.username }).getOne();
    const valid = await this.passwords.verify(dto.password, candidate?.passwordHash);
    const denied = () => new ApiException(401, 'AUTH_INVALID_CREDENTIALS', '管理员账号或密码错误');
    if (!candidate || !valid) throw denied();
    return this.db.transaction(async m => {
      const a = await this.lock(m, candidate.id);
      if (!a?.enabled || a.passwordHash !== candidate.passwordHash) throw denied();
      const s = m.create(AdminSession, { id: randomUUID(), adminId: a.id, revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000) });
      await m.save(s);
      return this.tokens(m, a, s);
    });
  }
  async authenticate(header?: string): Promise<AdminPrincipal> {
    const match = /^Bearer ([A-Za-z0-9_.-]+)$/i.exec(header ?? '');
    if (!match) throw invalid();
    let c: { sub?: unknown; sid?: unknown; exp?: unknown };
    try { c = await this.jwt.verifyAsync(match[1], { secret: this.config.secret, algorithms: ['HS256'], issuer: this.config.issuer, audience: 'admin' }); }
    catch { throw invalid(); }
    if (typeof c.sub !== 'string' || typeof c.sid !== 'string' || typeof c.exp !== 'number') throw invalid();
    const a = await this.db.getRepository(AdminAccount).findOneBy({ id: c.sub, enabled: true });
    const s = await this.db.getRepository(AdminSession).findOneBy({ id: c.sid, adminId: c.sub });
    if (!a || !s || s.revokedAt || s.expiresAt.getTime() <= Date.now()) throw invalid();
    return { account: a, sessionId: s.id };
  }
  async refresh(token: string) {
    const t = await this.db.getRepository(AdminRefreshToken).findOneBy({ tokenHash: digest(token) });
    const candidate = t && await this.db.getRepository(AdminSession).findOneBy({ id: t.sessionId });
    if (!t || !candidate) throw invalid();
    const result = await this.db.transaction(async m => {
      const a = await this.lock(m, candidate.adminId);
      const s = await m.findOne(AdminSession, { where: { id: candidate.id }, lock: { mode: 'pessimistic_write' } });
      if (!a?.enabled || !s || s.revokedAt || s.expiresAt.getTime() <= Date.now()) return null;
      const locked = await m.findOne(AdminRefreshToken, { where: { id: t.id }, lock: { mode: 'pessimistic_write' } });
      if (!locked) return null;
      if (locked.usedAt) { await m.update(AdminSession, s.id, { revokedAt: new Date() }); return null; }
      await m.update(AdminRefreshToken, t.id, { usedAt: new Date() });
      return this.tokens(m, a, s);
    });
    if (!result) throw invalid();
    return result;
  }
  async logout(p: AdminPrincipal) {
    await this.db.transaction(async m => {
      await this.lock(m, p.account.id);
      await m.update(AdminSession, { id: p.sessionId, adminId: p.account.id }, { revokedAt: new Date() });
    });
    return { success: true };
  }
}
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly auth: AdminAuthService, private readonly reflector: Reflector) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<AdminRequest>();
    req.admin = await this.auth.authenticate(req.headers.authorization);
    const permission = this.reflector.getAllAndOverride<Permission>('commerce:permission', [ctx.getHandler(), ctx.getClass()]);
    if (permission && !req.admin.account.permissions.includes(permission)) throw new ApiException(403, 'PERMISSION_DENIED', '没有此操作权限');
    return true;
  }
}
@Controller('admin')
export class AdminAuthController {
  constructor(private readonly service: AdminAuthService) {}
  @Post('auth/login') @HttpCode(200) @Throttle({ default: { limit: 5, ttl: 60000 } })
  login(@Body() dto: AdminLoginDto) { return this.service.login(dto); }
  @Post('auth/refresh') @HttpCode(200) @Throttle({ default: { limit: 30, ttl: 60000 } })
  refresh(@Body() dto: RefreshDto) { return this.service.refresh(dto.refreshToken); }
  @Post('auth/logout') @HttpCode(200) @UseGuards(AdminGuard)
  logout(@Req() req: AdminRequest) { return this.service.logout(req.admin); }
  @Get('me') @UseGuards(AdminGuard)
  me(@Req() req: AdminRequest) { return this.service.summary(req.admin.account); }
}
@Module({ imports: [JwtModule.register({})], controllers: [AdminAuthController],
  providers: [AdminAuthService, AdminGuard, PasswordService], exports: [AdminAuthService, AdminGuard] })
export class AdminAuthModule {}
