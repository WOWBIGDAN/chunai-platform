import 'reflect-metadata';
import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { randomBytes, randomUUID } from 'node:crypto';
import { AuthSession, RefreshToken, User } from '../../src/database/entities';
import { setupApp } from '../../src/setup-app';

const testDatabase = process.env.TEST_DB_NAME;
if (!testDatabase || !/^[A-Za-z0-9_]+_test$/.test(testDatabase)) {
  throw new Error('test:e2e requires TEST_DB_NAME ending in _test and a dedicated, empty MySQL database');
}
if (!process.env.TEST_DB_PASSWORD) throw new Error('TEST_DB_PASSWORD is required');
Object.assign(process.env, {
  NODE_ENV: 'test', DB_HOST: process.env.TEST_DB_HOST ?? '127.0.0.1',
  DB_PORT: process.env.TEST_DB_PORT ?? '3306', DB_USER: process.env.TEST_DB_USER ?? 'chunai_test',
  DB_PASSWORD: process.env.TEST_DB_PASSWORD, DB_NAME: testDatabase,
  JWT_SECRET: randomBytes(48).toString('hex'), TERMS_VERSION: '2026-10-01', PRIVACY_VERSION: '2026-10-01',
});

describe('authentication with real MySQL', () => {
  let app: INestApplication;
  let db: DataSource;
  let rateApp: INestApplication;
  let nextPhone = 13000000000 + Math.floor(Math.random() * 100000000);
  const createdUsers: string[] = [];
  const password = 'Example#Password9';
  const registration = () => ({
    phone: `+86${++nextPhone}`, password, nickname: '测试用户',
    termsVersion: '2026-10-01', privacyVersion: '2026-10-01',
  });
  const api = () => request(app.getHttpServer());
  const me = (token: string) => api().get('/api/v1/me').auth(token, { type: 'bearer' });
  const refresh = (token: string) => api().post('/api/v1/auth/refresh').send({ refreshToken: token });
  const login = (phone: string, value = password) => api().post('/api/v1/auth/login/password').send({ phone, password: value });
  const register = async () => {
    const input = registration();
    const response = await api().post('/api/v1/auth/register').send(input).expect(201);
    createdUsers.push(response.body.data.user.id);
    return { ...response.body.data, input };
  };

  beforeAll(async () => {
    const { AppModule } = await import('../../src/app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerGuard).useValue({ canActivate: () => true }).compile();
    app = module.createNestApplication({ bodyParser: false });
    setupApp(app);
    db = app.get(DataSource);
    await db.runMigrations();
    await app.init();
  });

  afterAll(async () => {
    if (db?.isInitialized) {
      // Remove only users created by this test run; cascading FKs clean their sessions.
      for (const id of createdUsers) await db.getRepository(User).delete(id);
    }
    if (rateApp) await rateApp.close();
    if (app) await app.close();
  });

  it('runs migrations once, with a unique phone index and foreign keys', async () => {
    expect(await db.runMigrations()).toEqual([]);
    await expect(db.getRepository(AuthSession).insert({
      id: randomUUID(), userId: randomUUID(), deviceLabel: 'test',
      expiresAt: new Date(Date.now() + 1000), lastActiveAt: new Date(),
    })).rejects.toMatchObject({ driverError: { code: 'ER_NO_REFERENCED_ROW_2' } });
  });

  it('reports readiness only after querying the real database', async () => {
    const response = await api().get('/api/v1/health').expect(200);
    expect(response.body.data).toEqual({ status: 'ok' });
  });

  it('registers without SMS, returns safe user data and stores hashes only', async () => {
    const user = await register();
    expect(user.tokenType).toBe('Bearer');
    expect(user.accessExpiresInSeconds).toBe(900);
    expect(user.user.phoneMasked).toMatch(/^\d{3}\*{4}\d{4}$/);
    const response = await me(user.accessToken).expect(200);
    expect(response.body.data).toEqual(user.user);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers['x-request-id']).toBe(response.body.requestId);
    const stored = await db.getRepository(User).createQueryBuilder('u').addSelect('u.passwordHash')
      .where('u.id = :id', { id: user.user.id }).getOneOrFail();
    expect(stored.passwordHash).toMatch(/^scrypt\$/);
    expect(stored.phoneVerifiedAt).toBeNull();
    expect(stored.termsVersion).toBe(user.input.termsVersion);
    expect(Math.abs(Date.now() - stored.createdAt.getTime())).toBeLessThan(10000);
    expect(Math.abs(Date.now() - stored.updatedAt.getTime())).toBeLessThan(10000);
    const tokens = await db.getRepository(RefreshToken).createQueryBuilder('t').addSelect('t.tokenHash').getMany();
    expect(tokens.some((token) => token.tokenHash === user.refreshToken)).toBe(false);
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(response.body.data).not.toHaveProperty('phone');
    await login(user.input.phone).expect(200);
  });

  it('enforces the unique phone constraint during concurrent registrations', async () => {
    const input = registration();
    const results = await Promise.all([1, 2].map(() => api().post('/api/v1/auth/register').send(input)));
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    createdUsers.push(results.find((result) => result.status === 201)!.body.data.user.id);
    expect(results.find((result) => result.status === 409)!.body.code).toBe('PHONE_ALREADY_REGISTERED');
    expect(await db.getRepository(User).countBy({ phone: input.phone })).toBe(1);
  });

  it('rejects privileged fields, SMS fields, invalid types and outdated consent', async () => {
    for (const patch of [{ role: 'admin' }, { smsCode: '123456' }, { password: 'short' }, { phone: 13800000000 }]) {
      const response = await api().post('/api/v1/auth/register').send({ ...registration(), ...patch }).expect(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    }
    const response = await api().post('/api/v1/auth/register').send({ ...registration(), termsVersion: 'old' }).expect(409);
    expect(response.body.code).toBe('PROTOCOL_VERSION_CHANGED');
  });

  it('uses the same error for an unknown phone and a wrong password', async () => {
    const user = await register();
    const wrong = await login(user.input.phone, 'wrong-password').expect(401);
    const missing = await login(registration().phone, 'wrong-password').expect(401);
    expect(wrong.body.code).toBe('AUTH_INVALID_CREDENTIALS');
    expect(missing.body.message).toBe(wrong.body.message);
  });

  it('rotates refresh tokens with an absolute expiry and revokes the chain on replay', async () => {
    const user = await register();
    const rotated = (await refresh(user.refreshToken).expect(200)).body.data;
    expect(rotated.refreshToken).not.toBe(user.refreshToken);
    expect(rotated.refreshExpiresAt).toBe(user.refreshExpiresAt);
    await me(rotated.accessToken).expect(200);
    const replay = await refresh(user.refreshToken).expect(401);
    expect(replay.body.code).toBe('REFRESH_TOKEN_REUSED');
    await me(rotated.accessToken).expect(401);
    await me(user.accessToken).expect(401);
    await refresh(rotated.refreshToken).expect(401);
  });

  it('serializes simultaneous refresh requests and persists replay revocation', async () => {
    const user = await register();
    const responses = await Promise.all([refresh(user.refreshToken), refresh(user.refreshToken)]);
    expect(responses.map((item) => item.status).sort()).toEqual([200, 401]);
    expect(responses.find((item) => item.status === 401)!.body.code).toBe('REFRESH_TOKEN_REUSED');
    await me(responses.find((item) => item.status === 200)!.body.data.accessToken).expect(401);
  });

  it('logs out only the current session and immediately invalidates its JWT and refresh token', async () => {
    const user = await register();
    const second = (await login(user.input.phone).expect(200)).body.data;
    await api().post('/api/v1/auth/logout').auth(user.accessToken, { type: 'bearer' }).expect(200);
    await me(user.accessToken).expect(401);
    await refresh(user.refreshToken).expect(401);
    await me(second.accessToken).expect(200);
  });

  it('changes the password and revokes all devices, including their refresh tokens', async () => {
    const user = await register();
    const second = (await login(user.input.phone).expect(200)).body.data;
    await api().put('/api/v1/me/password').auth(user.accessToken, { type: 'bearer' })
      .send({ currentPassword: 'wrong', newPassword: 'New#Password123' }).expect(401);
    await me(user.accessToken).expect(200);
    await api().put('/api/v1/me/password').auth(user.accessToken, { type: 'bearer' })
      .send({ currentPassword: password, newPassword: 'New#Password123' }).expect(200);
    for (const token of [user, second]) {
      await me(token.accessToken).expect(401);
      await refresh(token.refreshToken).expect(401);
    }
    await login(user.input.phone).expect(401);
    await login(user.input.phone, 'New#Password123').expect(200);
  });

  it('limits session listing and revocation to the owner', async () => {
    const first = await register();
    const second = await register();
    const sessions = await api().get('/api/v1/me/sessions?page=1&pageSize=1')
      .auth(first.accessToken, { type: 'bearer' }).expect(200);
    expect(sessions.body.data.total).toBe(1);
    expect(sessions.body.data.items[0].isCurrent).toBe(true);
    const id = sessions.body.data.items[0].id;
    await api().delete(`/api/v1/me/sessions/${id}`).auth(second.accessToken, { type: 'bearer' }).expect(404);
    await api().delete(`/api/v1/me/sessions/${id}`).auth(first.accessToken, { type: 'bearer' }).expect(200);
    await me(first.accessToken).expect(401);
    await api().get('/api/v1/me/sessions?page=1e2').auth(second.accessToken, { type: 'bearer' }).expect(400);
    await api().get('/api/v1/me/sessions?page=1&page=2').auth(second.accessToken, { type: 'bearer' }).expect(400);
  });

  it('rejects banned users and does not restore revoked sessions after unbanning', async () => {
    const user = await register();
    await db.getRepository(User).update(user.user.id, { status: 'BANNED' });
    await me(user.accessToken).expect(401);
    await login(user.input.phone).expect(403);
    await db.getRepository(User).update(user.user.id, { status: 'ACTIVE' });
    await me(user.accessToken).expect(401);
    await refresh(user.refreshToken).expect(401);
  });

  it('rejects malformed, expired and wrong-audience access tokens and expired sessions', async () => {
    const user = await register();
    const jwt = app.get(JwtService);
    const claims = jwt.decode(user.accessToken) as { sub: string; sid: string };
    for (const audience of ['admin', 'client']) {
      const token = await jwt.signAsync({ sid: claims.sid }, {
        secret: process.env.JWT_SECRET, subject: claims.sub, issuer: 'chunai-platform',
        audience, expiresIn: audience === 'client' ? -1 : 100,
      });
      const response = await me(token).expect(401);
      expect(response.body.code).toBe(audience === 'client' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID');
    }
    await me('bad-token').expect(401);
    await api().get('/api/v1/me').expect(401);
    await db.getRepository(AuthSession).update(claims.sid, { expiresAt: new Date(Date.now() - 1000) });
    await me(user.accessToken).expect(401);
    await refresh(user.refreshToken).expect(401);
  });

  it('exposes configured agreements and keeps SMS and unauthenticated password reset unavailable', async () => {
    const response = await api().get('/api/v1/public/legal-documents/TERMS').set('X-Request-ID', 'test_request_123').expect(200);
    expect(response.body.data.version).toBe('2026-10-01');
    expect(response.body.requestId).toBe('test_request_123');
    for (const path of ['sms-codes', 'login/sms', 'password/reset']) {
      await api().post(`/api/v1/auth/${path}`).send({}).expect(404);
    }
  });

  it('normalizes malformed JSON and oversized request errors', async () => {
    const invalid = await api().post('/api/v1/auth/register').set('Content-Type', 'application/json').send('{').expect(400);
    expect(invalid.body.code).toBe('VALIDATION_ERROR');
    const large = await api().post('/api/v1/auth/register').send({ text: 'x'.repeat(20000) }).expect(413);
    expect(large.body.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('enforces real endpoint rate limits and ignores spoofed forwarded IPs', async () => {
    const { AppModule } = await import('../../src/app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    rateApp = module.createNestApplication({ bodyParser: false });
    setupApp(rateApp);
    await rateApp.init();
    for (let i = 0; i < 5; i++) {
      await request(rateApp.getHttpServer()).post('/api/v1/auth/register')
        .set('X-Forwarded-For', `192.0.2.${i}`).send({}).expect(400);
    }
    const blocked = await request(rateApp.getHttpServer()).post('/api/v1/auth/register').send({}).expect(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });
});
