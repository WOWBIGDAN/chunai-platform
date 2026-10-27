import 'reflect-metadata';
import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { PasswordService } from '../../src/auth/password.service';
import { AdminAccount } from '../../src/commerce/entities';
import { PERMISSIONS } from '../../src/commerce/permissions';
import { AuthSession, User } from '../../src/database/entities';
import { setupApp } from '../../src/setup-app';

if (!process.env.TEST_DB_NAME || !/^[A-Za-z0-9_]+_test$/.test(process.env.TEST_DB_NAME) || !process.env.TEST_DB_PASSWORD) throw new Error('Users E2E requires an isolated _test database');
Object.assign(process.env, { NODE_ENV: 'test', DB_HOST: process.env.TEST_DB_HOST ?? '127.0.0.1', DB_PORT: process.env.TEST_DB_PORT ?? '3306',
  DB_USER: process.env.TEST_DB_USER ?? 'chunai_test', DB_PASSWORD: process.env.TEST_DB_PASSWORD, DB_NAME: process.env.TEST_DB_NAME,
  JWT_SECRET: randomBytes(48).toString('hex'), TERMS_VERSION: '2026-10-01', PRIVACY_VERSION: '2026-10-01', COMMERCE_TEST_PAYMENTS: 'true',
  CONTENT_MEDIA_ENCRYPTION_KEY: randomBytes(32).toString('base64'), CONTENT_IMAGE_OSS_HOST: 'chunai-photo.oss-cn-hangzhou.aliyuncs.com',
  CONTENT_MEDIA_DIR: resolve('.tmp/users-e2e-media'), PUBLIC_API_URL: 'http://localhost:3000/api/v1' });

describe('user profiles and admin moderation with real MySQL', () => {
  let app: INestApplication, db: DataSource, admin: any, reader: any, moderator: any;
  const userIds: string[] = [], adminIds: string[] = [], contentIds: string[] = [], mediaIds: string[] = [], categoryIds: string[] = [];
  const responses: { method: string; path: string; status: number; data: unknown }[] = [];
  const password = 'csUserProfilePassword#123';
  const oss = 'https://chunai-photo.oss-cn-hangzhou.aliyuncs.com';
  let nextPhone = 17800000000 + Math.floor(Math.random() * 100000000);
  const data = (r: request.Response) => r.body.data;
  const call = (method: 'get' | 'post' | 'put' | 'patch', path: string, who?: any, body?: any, key?: string) => {
    let req = request(app.getHttpServer())[method](`/api/v1${path}`);
    if (who) req = req.auth(who.accessToken, { type: 'bearer' });
    if (key) req = req.set('Idempotency-Key', key);
    req.on('response', (r: request.Response) => {
      if (r.status >= 200 && r.status < 300 && r.body?.data && !path.includes('/auth/')) responses.push({ method, path: path.split('?')[0], status: r.status, data: r.body.data });
    });
    return body === undefined ? req : req.send(body);
  };
  const post = (path: string, who: any, body: any, key = randomUUID()) => call('post', path, who, body, key);
  const code = (value: string) => (r: request.Response) => expect(r.body.code).toBe(value);
  async function account(permissions: readonly string[]) {
    const id = randomUUID(), username = `cs_${id}`;
    await db.getRepository(AdminAccount).save({ id, username, displayName: 'cs用户管理测试', passwordHash: await new PasswordService().hash(password), enabled: true, permissions: [...permissions], version: 1 });
    adminIds.push(id); return { ...data(await post('/admin/auth/login', null, { username, password }).expect(200)), id };
  }
  async function user(nickname = 'cs用户资料测试') {
    const phone = `+86${++nextPhone}`;
    const result = data(await post('/auth/register', null, { phone, password, nickname, termsVersion: '2026-10-01', privacyVersion: '2026-10-01' }).expect(201));
    userIds.push(result.user.id); return { ...result, phone };
  }
  function grant(who: any, overrides = {}) {
    return call('put', `/admin/users/${who.user.id}/membership`, admin, { version: 0,
      startsAt: new Date(Date.now() - 60000).toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(), reason: 'cs资料会员测试', ...overrides });
  }
  async function videoFixture() {
    const category = data(await post('/admin/categories', admin, { name: 'cs用户播放鉴权', scope: 'SCIENCE' }).expect(201)); categoryIds.push(category.id);
    const image = data(await post('/admin/content-media/images', admin, { purpose: 'CONTENT_COVER', publicUrl: `${oss}/cs-users.png`, mimeType: 'image/png', sizeBytes: 100 }).expect(201)); mediaIds.push(image.id);
    const video = data(await request(app.getHttpServer()).post('/api/v1/admin/content-media/videos?durationSeconds=3').auth(admin.accessToken, { type: 'bearer' })
      .set('Content-Type', 'video/mp4').send(readFileSync('database/seeds/cs-sample.mp4')).expect(201)); mediaIds.push(video.id);
    let content = data(await post('/admin/contents', admin, { kind: 'SCIENCE_VIDEO', title: 'cs用户封禁视频', summary: 'cs测试', coverMediaId: image.id,
      categoryId: category.id, accessPolicy: 'FREE', priceCents: 0 }).expect(201)); contentIds.push(content.id);
    content.version = data(await call('put', `/admin/contents/${content.id}/body`, admin, { version: content.version, videoMediaId: video.id }).expect(200)).version;
    content = data(await post(`/admin/contents/${content.id}/publish`, admin, { version: content.version }).expect(200)); return content;
  }
  beforeAll(async () => {
    const { AppModule } = await import('../../src/app.module');
    const mod = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(ThrottlerGuard).useValue({ canActivate: () => true }).compile();
    app = mod.createNestApplication({ bodyParser: false }); setupApp(app); db = app.get(DataSource); await db.runMigrations(); await app.init();
    admin = await account(PERMISSIONS); reader = await account(['users:read']); moderator = await account(['users:ban']);
  }, 120000);
  afterAll(async () => {
    mkdirSync('.tmp', { recursive: true }); writeFileSync('.tmp/users-contract-responses.json', JSON.stringify(responses));
    if (db?.isInitialized) {
      for (const id of contentIds) await db.query('DELETE FROM contents WHERE id = ?', [id]);
      for (const id of mediaIds) { await db.query('DELETE FROM content_media WHERE id = ?', [id]); await unlink(resolve(process.env.CONTENT_MEDIA_DIR!, `${id}.mp4`)).catch(() => {}); }
      for (const id of categoryIds) await db.query('DELETE FROM product_categories WHERE id = ?', [id]);
      for (const id of userIds) await db.query('DELETE FROM user_memberships WHERE user_id = ?', [id]);
      for (const [kind, ids] of [['user', userIds], ['admin', adminIds]] as const) for (const id of ids) {
        await db.query('DELETE FROM idempotency_records WHERE actor_key = ?', [`${kind}:${id}`]);
        await db.query('DELETE FROM commerce_audit_logs WHERE actor_key = ?', [`${kind}:${id}`]);
        await db.query(`DELETE FROM ${kind === 'user' ? 'users' : 'admin_accounts'} WHERE id = ?`, [id]);
      }
    }
    if (app) await app.close();
  });

  it('isolates customer/admin authentication and separates read and moderation permissions', async () => {
    const u = await user();
    await call('patch', '/me', undefined, { version: 1, nickname: 'cs修改' }).expect(401);
    await call('patch', '/me', admin, { version: 1, nickname: 'cs修改' }).expect(401);
    await call('get', '/admin/users').expect(401); await call('get', '/admin/users', u).expect(401);
    await call('get', `/admin/users/${u.user.id}`, moderator).expect(403);
    await post(`/admin/users/${u.user.id}/ban`, reader, { version: 1, reason: 'cs权限' }).expect(403);
    await post(`/admin/users/${u.user.id}/unban`, reader, { version: 1, reason: 'cs权限' }).expect(403);
    await call('get', `/admin/users/${u.user.id}`, reader).expect(200);
  });

  it('persists trimmed nickname and OSS avatar, returns real values on profile/login/refresh, and clears avatar', async () => {
    const u = await user(); expect(u.user.version).toBe(1); expect(u.user.avatarUrl).toBeNull();
    const changed = data(await call('patch', '/me', u, { version: 1, nickname: '  cs修改昵称  ', avatarUrl: `${oss}/avatars/cs-user.png` }).expect(200));
    expect(changed).toMatchObject({ id: u.user.id, nickname: 'cs修改昵称', avatarUrl: `${oss}/avatars/cs-user.png`, version: 2 });
    expect(data(await call('get', '/me', u).expect(200))).toEqual(changed);
    expect(data(await post('/auth/login/password', null, { phone: u.phone, password }).expect(200)).user).toEqual(changed);
    expect(data(await post('/auth/refresh', null, { refreshToken: u.refreshToken }).expect(200)).user).toEqual(changed);
    const cleared = data(await call('patch', '/me', u, { version: 2, avatarUrl: null }).expect(200));
    expect(cleared.avatarUrl).toBeNull(); expect(cleared.version).toBe(3); expect(cleared.nickname).toBe('cs修改昵称');
  });

  it('rejects protected-field injection, empty updates, null/blank/control nicknames and unsupported avatar sources', async () => {
    const u = await user();
    for (const body of [{ version: 1 }, { version: 1, nickname: null }, { version: 1, nickname: '   ' }, { version: 1, nickname: 'cs\u0001bad' },
      { version: 1, status: 'ACTIVE' }, { version: 1, role: 'admin' }, { version: 1, phone: '+8613800000000' }, { version: 1, membership: { active: true } },
      { version: 1, nickname: 'x'.repeat(33) }, { version: '1', nickname: 'cs错误版本' }]) await call('patch', '/me', u, body).expect(400);
    for (const avatarUrl of ['http://chunai-photo.oss-cn-hangzhou.aliyuncs.com/a.png', 'https://example.com/a.png',
      'https://chunai-photo.oss-cn-hangzhou.aliyuncs.com.evil.invalid/a.png', `${oss}/a.png?Signature=secret`, `${oss}/a.png#fragment`, `${oss}/`,
      `${oss}/a.png?Expires=123`, 'https://user:pass@chunai-photo.oss-cn-hangzhou.aliyuncs.com/a.png', `${oss}/${'图'.repeat(300)}`]) {
      await call('patch', '/me', u, { version: 1, avatarUrl }).expect(400);
    }
    expect(data(await call('get', '/me', u).expect(200)).version).toBe(1);
  });

  it('prevents lost profile updates under concurrent requests and never modifies another user', async () => {
    const u = await user(), other = await user();
    const results = await Promise.all([call('patch', '/me', u, { version: 1, nickname: 'cs并发甲' }), call('patch', '/me', u, { version: 1, nickname: 'cs并发乙' })]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    const winner = data(results.find(r => r.status === 200)!); expect(winner.version).toBe(2);
    expect(data(await call('get', '/me', u).expect(200))).toEqual(winner);
    expect(data(await call('get', '/me', other).expect(200))).toEqual(other.user);
    await call('patch', '/me', u, { version: 1, avatarUrl: null }).expect(409).expect(code('VERSION_CONFLICT'));
  });

  it('filters nickname literally, exact phone and dates with deterministic pagination, while masking phones and auditing reads', async () => {
    const marker = `cs-${randomUUID().slice(0, 8)}`, u = await user(`${marker}%_`); await user(`${marker}normal`);
    const listed = data(await call('get', `/admin/users?keyword=${encodeURIComponent(marker)}&pageSize=1`, reader).expect(200));
    expect(listed.total).toBe(2); expect(listed.items).toHaveLength(1); expect(listed.hasNext).toBe(true);
    const literal = data(await call('get', `/admin/users?keyword=${encodeURIComponent(`${marker}%_`)}`, reader).expect(200));
    expect(literal.items.map((x: any) => x.id)).toEqual([u.user.id]);
    const exact = data(await call('get', `/admin/users?phone=${encodeURIComponent(u.phone)}&createdFrom=2000-01-01T00%3A00%3A00Z`, reader).expect(200)); expect(exact.total).toBe(1);
    const detail = data(await call('get', `/admin/users/${u.user.id}`, reader).expect(200));
    expect(detail).toMatchObject({ id: u.user.id, banReason: null, bannedAt: null, version: 1 });
    expect(detail.lastLoginAt).toBeTruthy(); expect(detail.updatedAt).toBeTruthy();
    expect(JSON.stringify(detail)).not.toMatch(/passwordHash|refreshToken|consentedAt|termsVersion|privacyVersion/);
    expect(detail.phone).toBeUndefined(); expect(JSON.stringify(exact)).not.toContain(u.phone);
    const logs = await db.query('SELECT action, details FROM commerce_audit_logs WHERE actor_key = ?', [`admin:${reader.id}`]);
    expect(logs.some((x: any) => x.action === 'users.read')).toBe(true); expect(logs.some((x: any) => x.action === 'users.list')).toBe(true);
    expect(JSON.stringify(logs)).not.toContain(u.phone);
    for (const query of ['hasMembership=1', 'pageSize=101', 'status=INVALID', 'phone=13800000000', 'createdFrom=2026-02-01T00:00:00Z&createdTo=2026-01-01T00:00:00Z']) {
      await call('get', `/admin/users?${query}`, reader).expect(400);
    }
    await call('get', `/admin/users/${randomUUID()}`, reader).expect(404);
  });

  it('filters active membership consistently for ungranted, future, expired and revoked terms', async () => {
    const marker = `cs-member-${randomUUID().slice(0, 6)}`, active = await user(marker), future = await user(marker), expired = await user(marker), revoked = await user(marker), none = await user(marker);
    await grant(active).expect(200); await grant(expired).expect(200); await grant(future, { startsAt: new Date(Date.now() + 3600000).toISOString() }).expect(200);
    const record = data(await grant(revoked).expect(200));
    await post(`/admin/users/${revoked.user.id}/membership/revoke`, admin, { version: record.membership.version, reason: 'cs撤销' }).expect(200);
    await db.query('UPDATE user_memberships SET starts_at = ?, expires_at = ? WHERE user_id = ?', [new Date(Date.now() - 7200000), new Date(Date.now() - 3600000), expired.user.id]);
    const yes = data(await call('get', `/admin/users?keyword=${marker}&hasMembership=true`, reader).expect(200));
    expect(yes.items.map((x: any) => x.id)).toEqual([active.user.id]); expect(yes.items[0].membership.active).toBe(true);
    const no = data(await call('get', `/admin/users?keyword=${marker}&hasMembership=false`, reader).expect(200));
    expect(no.items.map((x: any) => x.id).sort()).toEqual([future.user.id, expired.user.id, revoked.user.id, none.user.id].sort());
    expect(no.items.every((x: any) => !x.membership.active)).toBe(true);
  });

  it('bans atomically, revokes every session and old video grant, blocks login/refresh/checkout, and preserves membership', async () => {
    const u = await user(); await grant(u).expect(200);
    const second = data(await post('/auth/login/password', null, { phone: u.phone, password }).expect(200));
    const video = await videoFixture(), playback = data(await call('get', `/videos/${video.id}/playback`, u).expect(200));
    const parsed = new URL(playback.playbackUrl); await request(app.getHttpServer()).get(parsed.pathname + parsed.search).set('Range', 'bytes=0-31').expect(206);
    const before = (await db.query('SELECT starts_at, expires_at, revoked_at FROM user_memberships WHERE user_id = ?', [u.user.id]))[0];
    const banned = data(await post(`/admin/users/${u.user.id}/ban`, moderator, { version: 1, reason: '  cs违规测试  ' }).expect(200));
    expect(banned).toMatchObject({ status: 'BANNED', version: 2, banReason: 'cs违规测试', membership: { active: false } }); expect(banned.bannedAt).toBeTruthy();
    const sessions = await db.getRepository(AuthSession).findBy({ userId: u.user.id }); expect(sessions.length).toBe(2); expect(sessions.every(x => !!x.revokedAt)).toBe(true);
    for (const session of [u, second]) { await call('get', '/me', session).expect(401); await post('/auth/refresh', null, { refreshToken: session.refreshToken }).expect(401); }
    await post('/auth/login/password', null, { phone: u.phone, password }).expect(403).expect(code('ACCOUNT_BANNED'));
    await post('/order-quotes', u, { type: 'COURSE', courseId: video.id }).expect(401);
    await request(app.getHttpServer()).get(parsed.pathname + parsed.search).set('Range', 'bytes=0-31').expect(401);
    expect((await db.query('SELECT starts_at, expires_at, revoked_at FROM user_memberships WHERE user_id = ?', [u.user.id]))[0]).toEqual(before);
    const detail = data(await call('get', `/admin/users/${u.user.id}`, reader).expect(200)); expect(detail).toEqual(banned);
  });

  it('makes ban/unban idempotent, rejects stale state and requires fresh login after unban', async () => {
    const u = await user(); const key = randomUUID(), input = { version: 1, reason: 'cs重复封禁' };
    await call('post', `/admin/users/${u.user.id}/ban`, moderator, input).expect(400).expect(code('IDEMPOTENCY_KEY_REQUIRED'));
    const first = data(await post(`/admin/users/${u.user.id}/ban`, moderator, input, key).expect(200));
    expect(data(await post(`/admin/users/${u.user.id}/ban`, moderator, input, key).expect(200))).toEqual(first);
    await post(`/admin/users/${u.user.id}/ban`, moderator, { ...input, reason: 'cs不同理由' }, key).expect(409).expect(code('IDEMPOTENCY_CONFLICT'));
    await post(`/admin/users/${u.user.id}/unban`, moderator, { version: 1, reason: 'cs旧版本' }).expect(409).expect(code('VERSION_CONFLICT'));
    await post(`/admin/users/${u.user.id}/ban`, moderator, { version: 2, reason: 'cs已封禁' }).expect(409).expect(code('USER_STATUS_CONFLICT'));
    const unbanKey = randomUUID(), unbanInput = { version: 2, reason: 'cs解除测试' };
    const restored = data(await post(`/admin/users/${u.user.id}/unban`, moderator, unbanInput, unbanKey).expect(200));
    expect(restored).toMatchObject({ status: 'ACTIVE', version: 3, banReason: null, bannedAt: null });
    expect(data(await post(`/admin/users/${u.user.id}/unban`, moderator, unbanInput, unbanKey).expect(200))).toEqual(restored);
    await call('get', '/me', u).expect(401); await post('/auth/refresh', null, { refreshToken: u.refreshToken }).expect(401);
    const newSession = data(await post('/auth/login/password', null, { phone: u.phone, password }).expect(200)); await call('get', '/me', newSession).expect(200);
    const logs = await db.query("SELECT action FROM commerce_audit_logs WHERE resource_id = ? AND action IN ('users.ban', 'users.unban')", [u.user.id]);
    expect(logs).toHaveLength(2);
  });

  it('prevents moderation from reviving deactivated users and validates reason and version', async () => {
    const u = await user(); await db.getRepository(User).update(u.user.id, { status: 'DEACTIVATED' });
    for (const operation of ['ban', 'unban']) {
      await post(`/admin/users/${u.user.id}/${operation}`, admin, { version: 1, reason: 'cs无效状态' }).expect(409).expect(code('USER_STATUS_CONFLICT'));
      for (const body of [{ version: 1 }, { version: 1, reason: ' ' }, { version: 0, reason: 'cs错误' }, { version: 1, reason: 'cs错误', bannedUntil: new Date().toISOString() }]) {
        await post(`/admin/users/${u.user.id}/${operation}`, admin, body).expect(400);
      }
    }
    await post(`/admin/users/${randomUUID()}/ban`, admin, { version: 1, reason: 'cs不存在' }).expect(404);
  });

  it('rechecks live admin permissions and makes profile/moderation races converge without restoring banned state', async () => {
    const limited = await account(['users:read', 'users:ban']), u = await user();
    await db.getRepository(AdminAccount).update(limited.id, { permissions: [] });
    await call('get', '/admin/users', limited).expect(403);
    await post(`/admin/users/${u.user.id}/ban`, limited, { version: 1, reason: 'cs权限撤销' }).expect(403);
    const outcomes = await Promise.all([call('patch', '/me', u, { version: 1, nickname: 'cs竞态更新' }), post(`/admin/users/${u.user.id}/ban`, moderator, { version: 1, reason: 'cs竞态封禁' })]);
    expect(outcomes.filter(r => r.status === 200)).toHaveLength(1);
    expect(outcomes.every(r => [200, 401, 409].includes(r.status))).toBe(true);
    const current = data(await call('get', `/admin/users/${u.user.id}`, reader).expect(200));
    if (current.status === 'ACTIVE') await post(`/admin/users/${u.user.id}/ban`, moderator, { version: current.version, reason: 'cs竞态后封禁' }).expect(200);
    await call('get', '/me', u).expect(401);
  });
});
