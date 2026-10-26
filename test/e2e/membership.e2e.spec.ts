import 'reflect-metadata';
import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { setupApp } from '../../src/setup-app';
import { PasswordService } from '../../src/auth/password.service';
import { AdminAccount, Order } from '../../src/commerce/entities';
import { PERMISSIONS } from '../../src/commerce/permissions';
import { MembershipEntitlement } from '../../src/membership/entities';
import { activeMembership } from '../../src/membership/membership-access';

if (!process.env.TEST_DB_NAME || !/^[A-Za-z0-9_]+_test$/.test(process.env.TEST_DB_NAME) || !process.env.TEST_DB_PASSWORD) throw new Error('Membership E2E requires an isolated _test database');
Object.assign(process.env, { NODE_ENV: 'test', DB_HOST: process.env.TEST_DB_HOST ?? '127.0.0.1', DB_PORT: process.env.TEST_DB_PORT ?? '3306',
  DB_USER: process.env.TEST_DB_USER ?? 'chunai_test', DB_PASSWORD: process.env.TEST_DB_PASSWORD, DB_NAME: process.env.TEST_DB_NAME,
  JWT_SECRET: randomBytes(48).toString('hex'), TERMS_VERSION: '2026-10-01', PRIVACY_VERSION: '2026-10-01', COMMERCE_TEST_PAYMENTS: 'true' });

describe('membership purchase, renewal and refunds with real MySQL', () => {
  let app: INestApplication, db: DataSource, admin: any, reader: any, customer: any;
  const admins: string[] = [], users: string[] = [], plans: string[] = [];
  const responses: { method: string; path: string; status: number; data: unknown }[] = [];
  const password = 'csMembershipTest#123';
  const day = 86400000;
  let phone = 17200000000 + Math.floor(Math.random() * 100000000);
  const call = (method: 'get' | 'post' | 'patch' | 'put', path: string, who?: any, body?: any, key?: string) => {
    let req = request(app.getHttpServer())[method](`/api/v1${path}`);
    if (who) req = req.auth(who.accessToken, { type: 'bearer' });
    if (key) req = req.set('Idempotency-Key', key);
    req.on('response', (r: request.Response) => {
      if (r.status >= 200 && r.status < 300 && r.body?.data && !path.includes('/auth/')) responses.push({ method, path: path.split('?')[0], status: r.status, data: r.body.data });
    });
    return body === undefined ? req : req.send(body);
  };
  const post = (path: string, who: any, body: any, key = randomUUID()) => call('post', path, who, body, key);
  const data = (r: request.Response) => r.body.data;
  const code = (expected: string) => (r: request.Response) => expect(r.body.code).toBe(expected);
  async function account(permissions: readonly string[]) {
    const id = randomUUID(), username = `cs_${id}`;
    await db.getRepository(AdminAccount).save({ id, username, displayName: 'cs会员测试管理员', passwordHash: await new PasswordService().hash(password), enabled: true, permissions: [...permissions], version: 1 });
    admins.push(id); return { ...data(await post('/admin/auth/login', null, { username, password }).expect(200)), id };
  }
  async function user() {
    const phoneValue = `+86${++phone}`;
    const u = data(await post('/auth/register', null, { phone: phoneValue, password, termsVersion: '2026-10-01', privacyVersion: '2026-10-01' }).expect(201));
    users.push(u.user.id); return { ...u, phone: phoneValue };
  }
  async function plan(enabled = true, extra = {}) {
    let p = data(await post('/admin/membership-plans', admin, { name: `cs会员${randomUUID()}`, description: 'cs会员内容访问套餐', durationDays: 30,
      priceCents: 1990, benefitCodes: ['MEMBER_CONTENT'], sortOrder: 1, ...extra }).expect(201));
    plans.push(p.id); expect(p.enabled).toBe(false);
    if (enabled) p = await patch(p, { enabled: true }); return p;
  }
  async function patch(p: any, extra: object) { return data(await call('patch', `/admin/membership-plans/${p.id}`, admin, { version: p.version, ...extra }).expect(200)); }
  async function quote(p: any, who = customer) { return data(await post('/order-quotes', who, { type: 'MEMBERSHIP', planId: p.id }).expect(201)); }
  async function order(p: any, who = customer) { const q = await quote(p, who); return data(await post('/orders', who, { quoteId: q.quoteId }).expect(201)); }
  async function pay(o: any) { return data(await post(`/admin/orders/${o.id}/test-payment`, admin, { version: o.version, transactionNo: randomUUID() }).expect(200)); }
  async function periods(who: any) { return data(await call('get', '/me/membership/periods', who).expect(200)); }
  async function refund(o: any) { return data(await post(`/admin/orders/${o.id}/digital-refund`, admin, { orderVersion: o.version, reason: 'cs退回尚未开始的续期' }).expect(202)); }
  async function settle(r: any, result = 'SUCCEEDED') { return data(await post(`/admin/refunds/${r.id}/test-result`, admin, { version: r.version, result }).expect(200)); }
  async function manual(who: any, days = 2) {
    return data(await call('put', `/admin/users/${who.user.id}/membership`, admin, { version: 0,
      startsAt: new Date(Date.now() - day).toISOString(), expiresAt: new Date(Date.now() + days * day).toISOString(), reason: 'cs赠送会员' }, randomUUID()).expect(200));
  }
  beforeAll(async () => {
    const { AppModule } = await import('../../src/app.module');
    const mod = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(ThrottlerGuard).useValue({ canActivate: () => true }).compile();
    app = mod.createNestApplication({ bodyParser: false }); setupApp(app); db = app.get(DataSource); await db.runMigrations(); await app.init();
    admin = await account(PERMISSIONS); reader = await account(['orders:read']); customer = await user();
  }, 120000);
  afterAll(async () => {
    mkdirSync('.tmp', { recursive: true }); writeFileSync('.tmp/membership-contract-responses.json', JSON.stringify(responses));
    if (db?.isInitialized) {
      for (const id of users) {
        const orders = 'SELECT id FROM commerce_orders WHERE user_id = ?';
        for (const sql of ['DELETE FROM membership_entitlements WHERE user_id = ?', 'DELETE FROM user_memberships WHERE user_id = ?',
          `DELETE FROM refunds WHERE order_id IN (${orders})`, `DELETE FROM payment_records WHERE order_id IN (${orders})`,
          `DELETE FROM order_items WHERE order_id IN (${orders})`, 'DELETE FROM commerce_orders WHERE user_id = ?', 'DELETE FROM order_quotes WHERE user_id = ?']) await db.query(sql, [id]);
      }
      for (const id of plans) await db.query('DELETE FROM membership_plans WHERE id = ?', [id]);
      for (const [kind, ids] of [['user', users], ['admin', admins]] as const) for (const id of ids) {
        await db.query('DELETE FROM idempotency_records WHERE actor_key = ?', [`${kind}:${id}`]);
        await db.query('DELETE FROM commerce_audit_logs WHERE actor_key = ?', [`${kind}:${id}`]);
        await db.query(`DELETE FROM ${kind === 'user' ? 'users' : 'admin_accounts'} WHERE id = ?`, [id]);
      }
    }
    if (app) await app.close();
  });

  it('lists enabled plans only and enforces administrator permissions and optimistic versions', async () => {
    let p = await plan(false);
    await call('get', `/membership-plans/${p.id}`).expect(404);
    await post('/order-quotes', customer, { type: 'MEMBERSHIP', planId: p.id }).expect(409);
    await call('get', '/admin/membership-plans', customer).expect(401);
    await call('get', '/admin/membership-plans', reader).expect(403);
    await call('patch', `/admin/membership-plans/${p.id}`, reader, { version: p.version, enabled: true }).expect(403);
    p = await patch(p, { enabled: true });
    expect(data(await call('get', `/membership-plans/${p.id}`).expect(200)).id).toBe(p.id);
    expect(data(await call('get', '/membership-plans').expect(200)).items.some((x: any) => x.id === p.id)).toBe(true);
    await call('get', `/admin/membership-plans/${p.id}`, admin).expect(200);
    await call('get', '/admin/membership-plans?enabled=true', admin).expect(200);
    await call('patch', `/admin/membership-plans/${p.id}`, admin, { version: p.version - 1, priceCents: 1 }).expect(409).expect(code('VERSION_CONFLICT'));
    await post('/admin/membership-plans', admin, { name: 'cs无效权益', description: '', durationDays: 30, priceCents: 1, benefitCodes: ['AI_CHAT'] }).expect(400);
  });

  it('rejects client pricing and cross-resource fields; rechecks a changed quote', async () => {
    const p = await plan(); const q = await quote(p);
    for (const extra of [{ priceCents: 1 }, { courseId: randomUUID() }, { addressId: randomUUID() }, { items: [{ skuId: randomUUID(), quantity: 1 }] }]) {
      await post('/order-quotes', customer, { type: 'MEMBERSHIP', planId: p.id, ...extra }).expect(400);
    }
    await patch(p, { durationDays: 15 });
    await post('/orders', customer, { quoteId: q.quoteId }).expect(409).expect(code('QUOTE_CHANGED'));
    await post('/order-quotes', customer, { type: 'MEMBERSHIP' }).expect(400);
  });

  it('preserves the order snapshot and grants membership exactly once on replayed payment', async () => {
    const who = await user(), p = await plan(), o = await order(p, who);
    await patch(p, { priceCents: 5555, durationDays: 60 });
    const body = { version: o.version, transactionNo: randomUUID() }, key = randomUUID();
    const paid = data(await post(`/admin/orders/${o.id}/test-payment`, admin, body, key).expect(200));
    expect(paid).toMatchObject({ type: 'MEMBERSHIP', status: 'COMPLETED', paidAmountCents: 1990, address: null });
    expect(paid.items[0]).toMatchObject({ resourceType: 'MEMBERSHIP_PLAN', resourceId: p.id, membershipSnapshot: { durationDays: 30, priceCents: 1990 } });
    expect(data(await post(`/admin/orders/${o.id}/test-payment`, admin, body, key).expect(200))).toEqual(paid);
    await post(`/admin/orders/${o.id}/test-payment`, admin, body).expect(409);
    expect(await db.getRepository(MembershipEntitlement).countBy({ orderId: o.id })).toBe(1);
    const e = await db.getRepository(MembershipEntitlement).findOneByOrFail({ orderId: o.id });
    expect(e.expiresAt.getTime() - e.startsAt.getTime()).toBe(30 * day);
    expect(await activeMembership(db.manager, who.user.id)).toBeTruthy();
    expect(data(await call('get', '/me', who).expect(200)).membership.active).toBe(true);
    expect(data(await call('get', '/me/membership', who).expect(200)).active).toBe(true);
    await call('get', `/orders/${o.id}`, customer).expect(404);
    await call('get', `/admin/orders/${o.id}`, admin).expect(200);
    expect(data(await call('get', '/orders?type=MEMBERSHIP', who).expect(200)).items).toHaveLength(1);
    await post(`/admin/orders/${o.id}/digital-refund`, admin, { orderVersion: paid.version, reason: 'cs已生效不能全额退' }).expect(409);
  });

  it('serializes duplicate orders but permits paid renewals with contiguous periods', async () => {
    const who = await user(), p = await plan(), q1 = await quote(p, who), q2 = await quote(p, who);
    const results = await Promise.all([post('/orders', who, { quoteId: q1.quoteId }), post('/orders', who, { quoteId: q2.quoteId })]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    const first = data(results.find(r => r.status === 201)!); await pay(first);
    const second = await pay(await order(p, who));
    const a = await db.getRepository(MembershipEntitlement).findOneByOrFail({ orderId: first.id });
    const b = await db.getRepository(MembershipEntitlement).findOneByOrFail({ orderId: second.id });
    expect(b.startsAt.getTime()).toBe(a.expiresAt.getTime());
    expect((await periods(who)).total).toBe(2);
    expect(data(await call('get', `/admin/users/${who.user.id}/membership/periods?pageSize=1`, admin).expect(200)).hasNext).toBe(true);
    await call('get', `/admin/users/${who.user.id}/membership/periods`, reader).expect(403);
    await call('get', `/admin/users/${who.user.id}/membership/periods`, customer).expect(401);
  });

  it('freezes future periods during refund then removes only the refunded duration', async () => {
    const who = await user(), p = await plan();
    const a = await pay(await order(p, who)), b = await pay(await order(p, who)), c = await pay(await order(p, who));
    const first = await db.getRepository(MembershipEntitlement).findOneByOrFail({ orderId: a.id });
    const r = await refund(b);
    expect((await db.getRepository(MembershipEntitlement).findOneByOrFail({ orderId: b.id })).status).toBe('REFUND_PENDING');
    expect((await db.getRepository(MembershipEntitlement).findOneByOrFail({ orderId: c.id })).status).toBe('SUSPENDED');
    expect(await activeMembership(db.manager, who.user.id)).toBeTruthy();
    const pending = await order(p, who);
    await post(`/admin/orders/${pending.id}/test-payment`, admin, { version: pending.version, transactionNo: randomUUID() }).expect(409);
    await settle(r);
    const tail = await db.getRepository(MembershipEntitlement).findOneByOrFail({ orderId: c.id });
    expect(tail.status).toBe('ACTIVE'); expect(tail.startsAt.getTime()).toBe(first.expiresAt.getTime());
    expect(tail.expiresAt.getTime() - tail.startsAt.getTime()).toBe(30 * day);
    expect((await db.getRepository(MembershipEntitlement).findOneByOrFail({ orderId: b.id })).status).toBe('REVOKED');
    const refunded = data(await call('get', `/orders/${b.id}`, who).expect(200));
    expect(refunded).toMatchObject({ status: 'CLOSED', paymentStatus: 'REFUNDED', refundedAmountCents: 1990 });
    await call('get', `/orders/${b.id}/refunds`, who).expect(200);
    await pay(pending);
  });

  it('restores failed-refund periods and allows safe retry without double refunds', async () => {
    const who = await user(), p = await plan();
    const a = await pay(await order(p, who)), b = await pay(await order(p, who));
    const original = await db.getRepository(MembershipEntitlement).findOneByOrFail({ orderId: b.id });
    const r = await refund(b); await settle(r, 'FAILED');
    const restored = await db.getRepository(MembershipEntitlement).findOneByOrFail({ orderId: b.id });
    expect(restored.status).toBe('ACTIVE'); expect(restored.startsAt).toEqual(original.startsAt); expect(restored.expiresAt).toEqual(original.expiresAt);
    const current = data(await call('get', `/orders/${b.id}`, who).expect(200)); const retry = await refund(current);
    expect(retry.id).toBe(r.id); await settle(retry); await post(`/admin/refunds/${retry.id}/test-result`, admin, { version: retry.version, result: 'SUCCEEDED' }).expect(409);
    expect((await db.getRepository(Order).findOneByOrFail({ id: a.id })).paymentStatus).toBe('PAID');
  });

  it('preserves manual membership, queues purchases after it, and prevents manual overwrites', async () => {
    const who = await user(), p = await plan(), gift = await manual(who);
    const paid = await pay(await order(p, who)); const e = await db.getRepository(MembershipEntitlement).findOneByOrFail({ orderId: paid.id });
    expect(e.startsAt.toISOString()).toBe(gift.membership.expiresAt);
    await post(`/admin/users/${who.user.id}/membership/revoke`, admin, { version: gift.membership.version, reason: 'cs不可覆盖付费期限' }).expect(409);
    await call('put', `/admin/users/${who.user.id}/membership`, admin, { version: gift.membership.version, startsAt: new Date().toISOString(), expiresAt: new Date(Date.now() + day).toISOString(), reason: 'cs不可覆盖' }, randomUUID()).expect(409);
    await settle(await refund(paid));
    const after = data(await call('get', '/me/membership', who).expect(200));
    expect(after.active).toBe(true); expect(after.membership.expiresAt).toBe(gift.membership.expiresAt);
  });

  it('reflows a failed refund after its original start without losing the purchased duration', async () => {
    const who = await user(), p = await plan(); await manual(who);
    const paid = await pay(await order(p, who)); const r = await refund(paid);
    const past = Date.now() - 2 * day;
    await db.query('UPDATE user_memberships SET starts_at = ?, expires_at = ? WHERE user_id = ?', [new Date(past - day), new Date(past), who.user.id]);
    await db.query('UPDATE membership_entitlements SET starts_at = ?, expires_at = ? WHERE order_id = ?', [new Date(past), new Date(past + 30 * day), paid.id]);
    expect(await activeMembership(db.manager, who.user.id)).toBeFalsy();
    const now = Date.now(); await settle(r, 'FAILED');
    const e = await db.getRepository(MembershipEntitlement).findOneByOrFail({ orderId: paid.id });
    expect(e.startsAt.getTime()).toBeGreaterThanOrEqual(now); expect(e.expiresAt.getTime() - e.startsAt.getTime()).toBe(30 * day);
    expect(await activeMembership(db.manager, who.user.id)).toBeTruthy();
  });

  it('rejects payments for disabled plans, banned users and expired orders without granting rights', async () => {
    const who = await user(); let p = await plan(); const o = await order(p, who);
    p = await patch(p, { enabled: false });
    await post(`/admin/orders/${o.id}/test-payment`, admin, { version: o.version, transactionNo: randomUUID() }).expect(409);
    await patch(p, { enabled: true });
    await post(`/admin/users/${who.user.id}/ban`, admin, { version: who.user.version, reason: 'cs会员支付封禁测试' }).expect(200);
    await post(`/admin/orders/${o.id}/test-payment`, admin, { version: o.version, transactionNo: randomUUID() }).expect(409);
    expect(await db.getRepository(MembershipEntitlement).countBy({ userId: who.user.id })).toBe(0);
    const fresh = await user(), expired = await order(p, fresh);
    await db.query('UPDATE commerce_orders SET payment_deadline_at = ? WHERE id = ?', [new Date(Date.now() - 1000), expired.id]);
    await post(`/admin/orders/${expired.id}/test-payment`, admin, { version: expired.version, transactionNo: randomUUID() }).expect(409);
    expect(await db.getRepository(MembershipEntitlement).countBy({ userId: fresh.user.id })).toBe(0);
    const cancelled = await order(p, fresh);
    await post(`/orders/${cancelled.id}/cancel`, fresh, { version: cancelled.version, reason: 'cs取消会员订单' }).expect(200);
    expect(await db.getRepository(MembershipEntitlement).countBy({ userId: fresh.user.id })).toBe(0);
    await post(`/admin/orders/${cancelled.id}/test-payment`, fresh, { version: cancelled.version, transactionNo: randomUUID() }).expect(401);
  });
});
