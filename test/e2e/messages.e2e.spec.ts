import 'reflect-metadata';
import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { DataSource, IsNull } from 'typeorm';
import request from 'supertest';
import { setupApp } from '../../src/setup-app';
import { PasswordService } from '../../src/auth/password.service';
import { AdminAccount } from '../../src/commerce/entities';
import { PERMISSIONS } from '../../src/commerce/permissions';
import { deliverMessage } from '../../src/messages/delivery';
import { UserMessage, UserMessageState } from '../../src/messages/entities';

if (!process.env.TEST_DB_NAME || !/^[A-Za-z0-9_]+_test$/.test(process.env.TEST_DB_NAME) || !process.env.TEST_DB_PASSWORD) {
  throw new Error('Messages E2E requires an isolated _test database');
}
Object.assign(process.env, { NODE_ENV: 'test', DB_HOST: process.env.TEST_DB_HOST ?? '127.0.0.1', DB_PORT: process.env.TEST_DB_PORT ?? '3306',
  DB_USER: process.env.TEST_DB_USER ?? 'chunai_test', DB_PASSWORD: process.env.TEST_DB_PASSWORD, DB_NAME: process.env.TEST_DB_NAME,
  JWT_SECRET: randomBytes(48).toString('hex'), TERMS_VERSION: '2026-10-01', PRIVACY_VERSION: '2026-10-01', COMMERCE_TEST_PAYMENTS: 'true' });

describe('in-site messages and bounded polling with real MySQL', () => {
  let app: INestApplication, db: DataSource, admin: any, reader: any;
  const users: string[] = [], admins: string[] = [];
  const responses: { method: string; path: string; status: number; data: unknown }[] = [];
  const password = 'csMessagesTest#123';
  let phone = 17500000000 + Math.floor(Math.random() * 100000000);
  const data = (r: request.Response) => r.body.data;
  const call = (method: 'get' | 'post' | 'put' | 'delete', path: string, who?: any, body?: any, key?: string) => {
    let req = request(app.getHttpServer())[method](`/api/v1${path}`);
    if (who) req = req.auth(who.accessToken, { type: 'bearer' });
    if (key) req = req.set('Idempotency-Key', key);
    req.on('response', (r: request.Response) => {
      if (r.status >= 200 && r.status < 300 && r.body?.data && !path.includes('/auth/')) {
        responses.push({ method, path: path.split('?')[0], status: r.status, data: r.body.data });
      }
    });
    return body === undefined ? req : req.send(body);
  };
  const poll = async (who: any, revision = '0') => data(await call('get', `/me/messages/poll?revision=${revision}`, who).expect(200));
  const list = async (who: any, query = '') => data(await call('get', `/me/messages${query}`, who).expect(200));
  async function user() {
    const result = data(await call('post', '/auth/register', undefined, { phone: `+86${++phone}`, password,
      nickname: 'cs消息测试', termsVersion: '2026-10-01', privacyVersion: '2026-10-01' }).expect(201));
    users.push(result.user.id); return result;
  }
  async function account(permissions: readonly string[]) {
    const id = randomUUID(), username = `cs_${id}`;
    await db.getRepository(AdminAccount).save({ id, username, displayName: 'cs消息管理员',
      passwordHash: await new PasswordService().hash(password), enabled: true, permissions: [...permissions], version: 1 });
    admins.push(id);
    return { ...data(await call('post', '/admin/auth/login', undefined, { username, password }).expect(200)), id };
  }
  async function deliver(who: any, eventKey = `cs:${randomUUID()}`) {
    await db.transaction('READ COMMITTED', m => deliverMessage(m, { userId: who.user.id, eventKey,
      category: 'SYSTEM', title: 'cs测试通知', body: 'cs测试消息正文' }));
  }
  const sendBody = (ids: string[]) => ({ userIds: ids, title: 'cs系统通知', body: 'cs请查看最新课程安排。' });

  beforeAll(async () => {
    const { AppModule } = await import('../../src/app.module');
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerGuard).useValue({ canActivate: () => true }).compile();
    app = mod.createNestApplication({ bodyParser: false }); setupApp(app);
    db = app.get(DataSource); await db.runMigrations(); await app.init();
    admin = await account(PERMISSIONS); reader = await account(['orders:read']);
  }, 120000);
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    mkdirSync('.tmp', { recursive: true });
    writeFileSync('.tmp/messages-contract-responses.json', JSON.stringify(responses));
    if (db?.isInitialized) {
      for (const id of users) {
        for (const table of ['user_messages', 'user_message_states', 'user_memberships']) {
          await db.query(`DELETE FROM ${table} WHERE user_id = ?`, [id]);
        }
      }
      for (const [kind, ids] of [['user', users], ['admin', admins]] as const) for (const id of ids) {
        await db.query('DELETE FROM idempotency_records WHERE actor_key = ?', [`${kind}:${id}`]);
        await db.query('DELETE FROM commerce_audit_logs WHERE actor_key = ?', [`${kind}:${id}`]);
        await db.query(`DELETE FROM ${kind === 'user' ? 'users' : 'admin_accounts'} WHERE id = ?`, [id]);
      }
    }
    if (app) await app.close();
  });

  it('polls an empty inbox without creating state, touching activity or scanning messages', async () => {
    const who = await user(), queries: string[] = [];
    const logger = jest.spyOn(db.logger, 'logQuery').mockImplementation(query => { queries.push(query); });
    expect(await poll(who)).toEqual({ changed: false, revision: '0', unreadCount: 0, latestSequence: '0', pollAfterSeconds: 60 });
    logger.mockRestore();
    expect(queries.filter(q => /user_message_states/i.test(q))).toHaveLength(1);
    expect(queries.some(q => /\b(?:INSERT|UPDATE|DELETE)\b|\bCOUNT\s*\(/i.test(q))).toBe(false);
    expect(queries.some(q => /\buser_messages\b/i.test(q))).toBe(false);
    expect(queries.filter(q => /^SELECT\b/i.test(q)).length).toBeLessThanOrEqual(4);
    expect(await db.getRepository(UserMessageState).countBy({ userId: who.user.id })).toBe(0);
    expect((await list(who)).items).toEqual([]);
  });

  it('enforces user/admin separation and permission checks before dispatching', async () => {
    const who = await user(), body = sendBody([who.user.id]);
    await call('get', '/me/messages/poll').expect(401);
    await call('get', '/me/messages', admin).expect(401);
    await call('post', '/admin/messages', who, body, randomUUID()).expect(401);
    await call('post', '/admin/messages', reader, body, randomUUID()).expect(403);
    await call('post', '/admin/messages', admin, body).expect(400);
    expect((await poll(who)).unreadCount).toBe(0);
  });

  it('sends a bounded batch once on idempotency replay and rolls back invalid recipients', async () => {
    const a = await user(), b = await user(), body = sendBody([a.user.id, b.user.id]), key = randomUUID();
    const result = data(await call('post', '/admin/messages', admin, body, key).expect(201));
    expect(result.sentCount).toBe(2); expect(new Set(result.messageIds).size).toBe(2);
    expect(data(await call('post', '/admin/messages', admin, body, key).expect(201))).toEqual(result);
    await call('post', '/admin/messages', admin, { ...body, title: 'cs不同消息' }, key).expect(409);
    for (const who of [a, b]) {
      expect(await poll(who)).toMatchObject({ changed: true, revision: '1', unreadCount: 1, latestSequence: '1' });
      expect((await list(who)).items[0]).toMatchObject({ category: 'SYSTEM', title: body.title, body: body.body, resourceType: null, resourceId: null });
    }
    await call('post', '/admin/messages', admin, sendBody([a.user.id, randomUUID()]), randomUUID()).expect(404);
    expect((await poll(a)).unreadCount).toBe(1);
    expect((await poll(b, '1')).changed).toBe(false);
  });

  it('isolates message details and atomically rejects mixed-owner read batches', async () => {
    const a = await user(), b = await user(); await deliver(a); await deliver(b);
    const own = (await list(a)).items[0], foreign = (await list(b)).items[0];
    expect(data(await call('get', `/me/messages/${own.id}`, a).expect(200)).readAt).toBeNull();
    await call('get', `/me/messages/${own.id}`, b).expect(404);
    await call('delete', `/me/messages/${own.id}`, b).expect(404);
    await call('post', '/me/messages/read', a, { ids: [own.id, foreign.id] }).expect(404);
    expect(await poll(a)).toMatchObject({ revision: '1', unreadCount: 1 });
    expect(data(await call('post', '/me/messages/read', a, { ids: [own.id] }).expect(200)))
      .toMatchObject({ updated: 1, revision: '2', unreadCount: 0, latestSequence: '1' });
    expect(data(await call('post', '/me/messages/read', a, { ids: [own.id] }).expect(200)))
      .toMatchObject({ updated: 0, revision: '2', unreadCount: 0 });
    expect((await list(a, '?unreadOnly=true')).items).toEqual([]);
    expect((await list(a, '?unreadOnly=false')).items).toHaveLength(1);
  });

  it('pages history backwards and catches up forwards without omissions across concurrent arrivals', async () => {
    const who = await user(); for (let i = 0; i < 5; i++) await deliver(who);
    const recent = await list(who, '?limit=2');
    expect(recent.items.map((v: any) => v.sequence)).toEqual(['5', '4']);
    expect(recent).toMatchObject({ hasMore: true, nextBeforeSequence: '4', nextAfterSequence: null });
    const older = await list(who, `?limit=2&beforeSequence=${recent.nextBeforeSequence}`);
    expect(older.items.map((v: any) => v.sequence)).toEqual(['3', '2']);
    const first = await list(who, '?limit=2&afterSequence=0');
    expect(first.items.map((v: any) => v.sequence)).toEqual(['1', '2']);
    expect(first).toMatchObject({ hasMore: true, nextAfterSequence: '2', nextBeforeSequence: null });
    await deliver(who);
    const seen = [...first.items]; let cursor = first.nextAfterSequence;
    for (let i = 0; i < 3; i++) {
      const next = await list(who, `?limit=2&afterSequence=${cursor}`);
      seen.push(...next.items); cursor = next.nextAfterSequence;
      if (!next.hasMore) break;
    }
    expect(seen.map(v => v.sequence)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect((await list(who, '?afterSequence=6')).nextAfterSequence).toBe('6');
  });

  it('deduplicates concurrent delivery and preserves the event tombstone after deletion', async () => {
    const who = await user(), event = `cs:${randomUUID()}`;
    await Promise.all([deliver(who, event), deliver(who, event), deliver(who, event)]);
    const item = (await list(who)).items[0];
    expect(await poll(who)).toMatchObject({ revision: '1', unreadCount: 1, latestSequence: '1' });
    expect(data(await call('delete', `/me/messages/${item.id}`, who).expect(200)))
      .toMatchObject({ updated: 1, revision: '2', unreadCount: 0, latestSequence: '1' });
    await call('get', `/me/messages/${item.id}`, who).expect(404);
    await call('post', '/me/messages/read', who, { ids: [item.id] }).expect(404);
    await deliver(who, event);
    expect(await poll(who)).toMatchObject({ revision: '2', unreadCount: 0, latestSequence: '1' });
    expect((await list(who)).items).toEqual([]);
    expect(await db.getRepository(UserMessage).countBy({ userId: who.user.id })).toBe(1);
  });

  it('commits message state and content together and leaves neither after business rollback', async () => {
    const who = await user();
    await expect(db.transaction(async m => {
      await deliverMessage(m, { userId: who.user.id, eventKey: `cs:${randomUUID()}`,
        category: 'ORDER', title: 'cs事务通知', body: 'cs回滚不会发送通知', resourceType: 'ORDER', resourceId: randomUUID() });
      throw new Error('cs rollback business operation');
    })).rejects.toThrow('cs rollback business operation');
    expect(await db.getRepository(UserMessage).countBy({ userId: who.user.id })).toBe(0);
    expect(await db.getRepository(UserMessageState).countBy({ userId: who.user.id })).toBe(0);
    expect(await poll(who)).toMatchObject({ revision: '0', unreadCount: 0, latestSequence: '0' });
  });

  it('keeps newly arriving messages unread when read-all races with delivery', async () => {
    const who = await user(); for (let i = 0; i < 3; i++) await deliver(who);
    const watermark = (await poll(who)).latestSequence;
    await Promise.all([
      call('post', '/me/messages/read-all', who, { throughSequence: watermark }).expect(200),
      ...Array.from({ length: 4 }, () => deliver(who)),
    ]);
    const state = await poll(who), unread = (await list(who, '?unreadOnly=true&afterSequence=0')).items;
    expect(state).toMatchObject({ unreadCount: 4, latestSequence: '7' });
    expect(unread.map((v: any) => v.sequence)).toEqual(['4', '5', '6', '7']);
    expect(await db.getRepository(UserMessage).countBy({ userId: who.user.id, readAt: IsNull(), deletedAt: IsNull() })).toBe(state.unreadCount);
    const repeated = data(await call('post', '/me/messages/read-all', who, { throughSequence: watermark }).expect(200));
    expect(repeated).toMatchObject({ updated: 0, revision: state.revision, unreadCount: 4 });
    await call('post', '/me/messages/read-all', who, { throughSequence: '8' }).expect(400);
  });

  it('keeps sequence and revision exact beyond JavaScript safe integer range', async () => {
    const who = await user(); await deliver(who);
    await db.getRepository(UserMessageState).update({ userId: who.user.id }, { nextSequence: '9007199254740992', revision: '9007199254740992' });
    await deliver(who); await deliver(who);
    expect(await poll(who, '9007199254740993')).toMatchObject({ changed: true, revision: '9007199254740994', latestSequence: '9007199254740994' });
    const next = await list(who, '?afterSequence=9007199254740992&limit=1');
    expect(next.items[0].sequence).toBe('9007199254740993');
    expect(next.nextAfterSequence).toBe('9007199254740993');
  });

  it('validates bounds, cursor types and message text before touching the inbox', async () => {
    const who = await user(), body = sendBody([who.user.id]);
    for (const query of ['?limit=0', '?limit=51', '?limit=1.5', '?afterSequence=-1', '?afterSequence=01',
      '?beforeSequence=1e3', '?afterSequence=0&beforeSequence=1', '?unreadOnly=1']) {
      await call('get', `/me/messages${query}`, who).expect(400);
    }
    await call('get', '/me/messages/poll?revision=-1', who).expect(400);
    for (const ids of [[], [randomUUID(), randomUUID(), ...Array.from({ length: 99 }, () => randomUUID())], [who.user.id, who.user.id]]) {
      await call('post', '/me/messages/read', who, { ids }).expect(400);
    }
    await call('post', '/me/messages/read-all', who, { throughSequence: 0 }).expect(400);
    for (const extra of [{ title: ' ' }, { title: 'x'.repeat(121) }, { body: '' }, { body: 'x'.repeat(2001) },
      { userIds: [] }, { userIds: [who.user.id, who.user.id] }, { userIds: Array.from({ length: 101 }, () => randomUUID()) },
      { resourceId: randomUUID() }, { category: 'ORDER' }]) {
      await call('post', '/admin/messages', admin, { ...body, ...extra }, randomUUID()).expect(400);
    }
    expect((await poll(who)).unreadCount).toBe(0);
  });

  it('sends membership notifications only when the underlying business update succeeds', async () => {
    const who = await user(), term = { version: 0, startsAt: new Date(Date.now() - 60000).toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(), reason: 'cs消息业务联动测试' };
    const granted = data(await call('put', `/admin/users/${who.user.id}/membership`, admin, term).expect(200));
    const first = (await list(who)).items;
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ category: 'MEMBERSHIP', resourceType: 'MEMBERSHIP', resourceId: who.user.id });
    expect(first[0].body).not.toContain(term.reason);
    await call('put', `/admin/users/${who.user.id}/membership`, admin, term).expect(409);
    expect((await poll(who)).unreadCount).toBe(1);
    const renewed = data(await call('put', `/admin/users/${who.user.id}/membership`, admin, { ...term,
      version: granted.membership.version, expiresAt: new Date(Date.now() + 2 * 86400000).toISOString() }).expect(200));
    await call('post', `/admin/users/${who.user.id}/membership/revoke`, admin,
      { version: renewed.membership.version, reason: 'cs撤销业务联动测试' }).expect(200);
    expect(await poll(who)).toMatchObject({ revision: '3', unreadCount: 3, latestSequence: '3' });
    expect((await list(who)).items.every((v: any) => v.category === 'MEMBERSHIP')).toBe(true);
  });
});
