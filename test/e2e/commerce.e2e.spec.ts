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
import { AdminAccount, AdminSession, AfterSale, Order, Refund, Sku } from '../../src/commerce/entities';
import { PERMISSIONS } from '../../src/commerce/permissions';
import { CommerceMaintenance } from '../../src/commerce/maintenance.service';

if (!process.env.TEST_DB_NAME || !/^[A-Za-z0-9_]+_test$/.test(process.env.TEST_DB_NAME) || !process.env.TEST_DB_PASSWORD) {
  throw new Error('Commerce E2E requires an isolated TEST_DB_NAME ending in _test and TEST_DB_PASSWORD');
}
Object.assign(process.env, { NODE_ENV: 'test', DB_HOST: process.env.TEST_DB_HOST ?? '127.0.0.1', DB_PORT: process.env.TEST_DB_PORT ?? '3306',
  DB_USER: process.env.TEST_DB_USER ?? 'chunai_test', DB_PASSWORD: process.env.TEST_DB_PASSWORD, DB_NAME: process.env.TEST_DB_NAME,
  JWT_SECRET: randomBytes(48).toString('hex'), TERMS_VERSION: '2026-10-01', PRIVACY_VERSION: '2026-10-01', COMMERCE_TEST_PAYMENTS: 'true' });

describe('commerce permissions and real MySQL business transactions', () => {
  let app: INestApplication;
  let db: DataSource;
  let full: any, reader: any, customer: any, stranger: any;
  let category: any, image: any;
  const password = 'Commerce#Password123';
  const userIds: string[] = [], adminIds: string[] = [], productIds: string[] = [], categoryIds: string[] = [];
  const responses: { method: string; path: string; status: number; data: unknown }[] = [];
  let phone = 15000000000 + Math.floor(Math.random() * 100000000);
  const api = () => request(app.getHttpServer());
  const call = (method: 'get' | 'post' | 'patch' | 'put' | 'delete', path: string, who?: any, body?: any, key?: string) => {
    let r = api()[method](`/api/v1${path}`);
    if (who) r = r.auth(who.accessToken, { type: 'bearer' });
    if (key) r = r.set('Idempotency-Key', key);
    if (!path.includes('/auth/') && path !== '/admin/me') r.on('response', (response: request.Response) => {
      if (response.status >= 200 && response.status < 300) responses.push({ method, path: path.split('?')[0], status: response.status, data: response.body.data });
    });
    return body === undefined ? r : r.send(body);
  };
  const post = (path: string, who: any, body: any, key = randomUUID()) => call('post', path, who, body, key);
  const snapshot = { recipient: '测试收件人', phone: '+8613800000000', provinceCode: '310000', province: '上海市', cityCode: '310100', city: '上海市', districtCode: '310101', district: '黄浦区', detail: '测试地址 100 号' };
  const data = (r: request.Response) => r.body.data;
  async function createCustomer() {
    const r = await call('post', '/auth/register', undefined, { phone: `+86${++phone}`, password, termsVersion: '2026-10-01', privacyVersion: '2026-10-01' }).expect(201);
    userIds.push(data(r).user.id); return data(r);
  }
  async function createAdmin(permissions: readonly string[]) {
    const id = randomUUID(), username = `test_${id.replace(/-/g, '').slice(0, 20)}`;
    await db.getRepository(AdminAccount).save({ id, username, displayName: '测试管理员', passwordHash: await new PasswordService().hash(password), permissions: [...permissions], enabled: true, version: 1 });
    adminIds.push(id);
    const r = await call('post', '/admin/auth/login', undefined, { username, password }).expect(200);
    return { ...data(r), username, id };
  }
  async function fixture(stock = 10, price = 1200) {
    const p = data(await post('/admin/products', full, { name: `测试商品 ${randomUUID()}`, summary: '商品说明', categoryId: category.id,
      coverMediaId: image.id, detailHtml: '<p onclick="evil()">安全说明<script>alert(1)</script><a href="javascript:evil()">链接</a></p>', afterSalePolicy: '确认收货后七天可申请' }).expect(201));
    productIds.push(p.id);
    const s = data(await post(`/admin/products/${p.id}/skus`, full, { skuCode: randomUUID(), attributes: [{ name: '规格', value: '标准' }], priceCents: price }).expect(201));
    await post(`/admin/skus/${s.id}/stock-adjustments`, full, { delta: stock, reason: '测试入库', version: s.version }).expect(201);
    const current = data(await call('get', `/admin/products/${p.id}`, full).expect(200));
    await post(`/admin/products/${p.id}/publish`, full, { version: current.version }).expect(200);
    return { product: p, sku: s };
  }
  async function quote(sku: any, who = customer, quantity = 1) {
    const a = data(await post('/me/addresses', who, snapshot).expect(201));
    return data(await post('/order-quotes', who, { type: 'PRODUCT', addressId: a.id, items: [{ skuId: sku.id, quantity }] }).expect(201));
  }
  async function order(sku: any, who = customer, quantity = 1) {
    const q = await quote(sku, who, quantity);
    return data(await post('/orders', who, { quoteId: q.quoteId }).expect(201));
  }
  async function paidOrder(sku: any, quantity = 1) {
    const o = await order(sku, customer, quantity);
    return data(await post(`/admin/orders/${o.id}/test-payment`, full, { version: o.version, transactionNo: randomUUID() }).expect(200));
  }
  async function sale(o: any, quantity = 1, type = 'REFUND_ONLY') {
    return data(await post('/aftersales', customer, { orderId: o.id, type, items: [{ orderItemId: o.items[0].id, quantity }], reasonCode: 'NOT_NEEDED', description: '测试售后' }).expect(201));
  }
  async function approve(a: any, extra = {}) {
    return data(await post(`/admin/aftersales/${a.id}/review`, full, { decision: 'APPROVE', note: '审核通过', version: a.version, ...extra }).expect(200));
  }

  beforeAll(async () => {
    const { AppModule } = await import('../../src/app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(ThrottlerGuard).useValue({ canActivate: () => true }).compile();
    app = module.createNestApplication({ bodyParser: false }); setupApp(app); db = app.get(DataSource); await db.runMigrations(); await app.init();
    full = await createAdmin(PERMISSIONS); reader = await createAdmin(['orders:read']);
    customer = await createCustomer(); stranger = await createCustomer();
    category = data(await post('/admin/categories', full, { name: '测试分类', scope: 'PRODUCT' }).expect(201)); categoryIds.push(category.id);
    image = data(await post('/admin/product-images', full, { publicUrl: 'https://example.com/product.jpg', mimeType: 'image/jpeg', sizeBytes: 1024 }).expect(201));
  });

  afterAll(async () => {
    mkdirSync('.tmp', { recursive: true });
    writeFileSync('.tmp/commerce-contract-responses.json', JSON.stringify(responses));
    if (db?.isInitialized && userIds.length) {
      // Only delete this run's test fixtures, never clear the entire database or disable FKs.
      const ids = userIds.map(() => '?').join(',');
      const orders = `SELECT id FROM commerce_orders WHERE user_id IN (${ids})`;
      const sales = `SELECT id FROM after_sales WHERE user_id IN (${ids})`;
      for (const sql of [
        `DELETE FROM logistics_events WHERE shipment_id IN (SELECT id FROM shipments WHERE order_id IN (${orders}))`,
        `DELETE FROM shipments WHERE order_id IN (${orders})`, `DELETE FROM refunds WHERE order_id IN (${orders})`,
        `DELETE FROM after_sale_items WHERE after_sale_id IN (${sales})`, `DELETE FROM after_sales WHERE user_id IN (${ids})`,
        `DELETE FROM payment_records WHERE order_id IN (${orders})`, `DELETE FROM stock_movements WHERE order_id IN (${orders})`,
        `DELETE FROM order_items WHERE order_id IN (${orders})`, `DELETE FROM commerce_orders WHERE user_id IN (${ids})`,
        `DELETE FROM order_quotes WHERE user_id IN (${ids})`, `DELETE FROM user_addresses WHERE user_id IN (${ids})`,
      ]) await db.query(sql, userIds);
      for (const id of productIds) {
        await db.query('DELETE FROM stock_movements WHERE sku_id IN (SELECT id FROM product_skus WHERE product_id = ?)', [id]);
        await db.query('DELETE FROM product_skus WHERE product_id = ?', [id]); await db.query('DELETE FROM products WHERE id = ?', [id]);
      }
      for (const id of [...categoryIds].reverse()) await db.query('DELETE FROM product_categories WHERE id = ?', [id]);
      for (const id of adminIds) {
        await db.query('DELETE FROM product_images WHERE operator_id = ?', [id]);
        await db.query('DELETE FROM admin_accounts WHERE id = ?', [id]);
      }
      for (const key of [...userIds.map(id => `user:${id}`), ...adminIds.map(id => `admin:${id}`)]) {
        await db.query('DELETE FROM idempotency_records WHERE actor_key = ?', [key]); await db.query('DELETE FROM commerce_audit_logs WHERE actor_key = ?', [key]);
      }
      for (const id of userIds) await db.query('DELETE FROM users WHERE id = ?', [id]);
    }
    if (app) await app.close();
  });

  it('separates client/admin audiences, refresh tokens and granular permissions', async () => {
    await call('get', '/admin/orders').expect(401);
    await call('get', '/admin/orders', customer).expect(401);
    await call('get', '/orders', full).expect(401);
    await call('get', '/admin/orders', reader).expect(200);
    await post('/admin/products', reader, {}).expect(403);
    await post(`/admin/orders/${randomUUID()}/shipment`, reader, {}).expect(403);
    await post(`/admin/aftersales/${randomUUID()}/review`, reader, {}).expect(403);
    await call('post', '/admin/auth/refresh', undefined, { refreshToken: customer.refreshToken }).expect(401);
    await call('post', '/auth/refresh', undefined, { refreshToken: full.refreshToken }).expect(401);
    await call('post', '/admin/auth/login', undefined, { username: customer.user.id, password }).expect(401);
    await call('post', '/auth/register', undefined, { phone: `+86${++phone}`, password, termsVersion: '2026-10-01', privacyVersion: '2026-10-01', permissions: ['orders:ship'] }).expect(400);
  });
  it('rotates and revokes admin sessions and checks current permissions on every request', async () => {
    const a = await createAdmin(['orders:read']);
    const rotated = data(await call('post', '/admin/auth/refresh', undefined, { refreshToken: a.refreshToken }).expect(200));
    await call('post', '/admin/auth/refresh', undefined, { refreshToken: a.refreshToken }).expect(401);
    await call('get', '/admin/orders', rotated).expect(401);
    const b = await createAdmin(['orders:read']);
    await db.getRepository(AdminAccount).update(b.id, { permissions: [] });
    await call('get', '/admin/orders', b).expect(403);
    await db.getRepository(AdminAccount).update(b.id, { enabled: false });
    await call('get', '/admin/me', b).expect(401);
    const c = await createAdmin(['orders:read']);
    await call('post', '/admin/auth/logout', c, {}).expect(200);
    await call('get', '/admin/me', c).expect(401);
  });
  it('hides drafts and disabled SKUs, sanitizes descriptions and rejects unsafe mutations', async () => {
    const f = await fixture();
    const publicProduct = data(await call('get', `/products/${f.product.id}`).expect(200));
    expect(publicProduct.detailHtml).not.toMatch(/script|onclick|javascript/);
    expect(publicProduct.skus[0]).not.toHaveProperty('reservedStock');
    await call('patch', `/admin/products/${f.product.id}`, full, { version: 1, name: '旧版本' }).expect(409);
    const current = data(await call('get', `/admin/products/${f.product.id}`, full).expect(200));
    await call('patch', `/admin/products/${f.product.id}`, full, { version: current.version, status: 'PUBLISHED' }).expect(400);
    await call('get', '/products?inStock=1').expect(400);
    await call('get', '/products?sort=priceCents:asc&minPriceCents=100&inStock=true').expect(200);
    await post(`/admin/products/${f.product.id}/unpublish`, full, { version: current.version }).expect(200);
    await call('get', `/products/${f.product.id}`).expect(404);
    await call('delete', `/admin/categories/${category.id}?version=${category.version}`, full).expect(409);
  });
  it('prevents category cycles and requires a valid category and image', async () => {
    const child = data(await post('/admin/categories', full, { name: '子类', scope: 'PRODUCT', parentId: category.id }).expect(201)); categoryIds.push(child.id);
    await call('patch', `/admin/categories/${category.id}`, full, { version: category.version, parentId: child.id }).expect(409);
    await post('/admin/product-images', full, { publicUrl: 'javascript:alert(1)', mimeType: 'image/jpeg', sizeBytes: 1 }).expect(400);
    await post('/admin/products', full, { name: '无效', summary: '说明', categoryId: randomUUID(), coverMediaId: image.id, detailHtml: '', afterSalePolicy: '规则' }).expect(409);
  });
  it('enforces ownership for address, quote, order, logistics, refund and aftersale reads/writes', async () => {
    const f = await fixture(); const a = data(await post('/me/addresses', customer, snapshot).expect(201));
    await call('get', `/me/addresses/${a.id}`, stranger).expect(404);
    await call('put', `/me/addresses/${a.id}`, stranger, { ...snapshot, isDefault: false, version: a.version }).expect(404);
    await call('delete', `/me/addresses/${a.id}?version=${a.version}`, stranger).expect(404);
    await post('/order-quotes', stranger, { type: 'PRODUCT', addressId: a.id, items: [{ skuId: f.sku.id, quantity: 1 }] }).expect(404);
    const q = await quote(f.sku); await post('/orders', stranger, { quoteId: q.quoteId }).expect(404);
    const o = await paidOrder(f.sku); const saleRecord = await sale(o);
    for (const path of [`/orders/${o.id}`, `/orders/${o.id}/logistics`, `/orders/${o.id}/refunds`, `/aftersales/${saleRecord.id}`]) await call('get', path, stranger).expect(404);
    await post(`/orders/${o.id}/cancel`, stranger, { version: o.version, reason: '越权' }).expect(404);
    await post(`/orders/${o.id}/confirm-receipt`, stranger, { version: o.version }).expect(404);
    await post(`/aftersales/${saleRecord.id}/cancel`, stranger, { version: saleRecord.version }).expect(404);
    expect(data(await call('get', '/orders', stranger).expect(200)).items).toHaveLength(0);
    expect(data(await call('get', `/aftersales?orderId=${o.id}`, stranger).expect(200)).items).toHaveLength(0);
    await call('get', `/orders?userId=${customer.user.id}`, stranger).expect(400);
  });
  it('creates one order per quote and replays only matching idempotent requests', async () => {
    const f = await fixture(4); const q = await quote(f.sku, customer, 2); const key = randomUUID();
    await call('post', '/orders', customer, { quoteId: q.quoteId }).expect(400);
    const results = await Promise.all([post('/orders', customer, { quoteId: q.quoteId }, key), post('/orders', customer, { quoteId: q.quoteId }, key)]);
    expect(results.map(r => r.status)).toEqual([201, 201]); expect(data(results[0]).id).toBe(data(results[1]).id);
    expect(data(await post('/orders', customer, { quoteId: q.quoteId }).expect(201)).id).toBe(data(results[0]).id);
    await post('/orders', customer, { quoteId: randomUUID() }, key).expect(409);
    const s = await db.getRepository(Sku).findOneByOrFail({ id: f.sku.id }); expect(s.reservedStock).toBe(2); expect(s.onHandStock).toBe(4);
    await post(`/admin/skus/${s.id}/stock-adjustments`, full, { version: s.version, delta: -3, reason: '不可移走预占' }).expect(409);
  });
  it('prevents overselling the last item across concurrent users', async () => {
    const f = await fixture(1); const q1 = await quote(f.sku), q2 = await quote(f.sku, stranger);
    const results = await Promise.all([post('/orders', customer, { quoteId: q1.quoteId }), post('/orders', stranger, { quoteId: q2.quoteId })]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    expect((await db.getRepository(Sku).findOneByOrFail({ id: f.sku.id })).reservedStock).toBe(1);
  });
  it('keeps address and price snapshots and rejects tampered amounts and stale quotes', async () => {
    const f = await fixture(); const q = await quote(f.sku);
    await post('/orders', customer, { quoteId: q.quoteId, payableAmountCents: 1 }).expect(400);
    const s = data(await call('get', `/admin/skus/${f.sku.id}`, full).expect(200));
    await call('patch', `/admin/skus/${f.sku.id}`, full, { version: s.version, priceCents: 2500 }).expect(200);
    await post('/orders', customer, { quoteId: q.quoteId }).expect(409);
    const o = await order(f.sku); expect(o.items[0].unitPriceCents).toBe(2500);
    const current = data(await call('get', `/admin/skus/${f.sku.id}`, full).expect(200));
    await call('patch', `/admin/skus/${f.sku.id}`, full, { version: current.version, priceCents: 5000 }).expect(200);
    const unchanged = data(await call('get', `/orders/${o.id}`, customer).expect(200)); expect(unchanged.items[0].unitPriceCents).toBe(2500); expect(unchanged.address).toEqual(snapshot);
  });
  it('expires unpaid orders once and releases reservations without losing stock', async () => {
    const f = await fixture(3); const o = await order(f.sku, customer, 2);
    await db.getRepository(Order).update(o.id, { paymentDeadlineAt: new Date(Date.now() - 1000) });
    await Promise.all([app.get(CommerceMaintenance).sweep(), app.get(CommerceMaintenance).sweep()]);
    const current = data(await call('get', `/orders/${o.id}`, customer).expect(200)); expect(current.status).toBe('CANCELLED');
    const s = await db.getRepository(Sku).findOneByOrFail({ id: f.sku.id }); expect(s.reservedStock).toBe(0); expect(s.onHandStock).toBe(3);
    await post(`/admin/orders/${o.id}/test-payment`, full, { version: current.version, transactionNo: randomUUID() }).expect(409);
  });
  it('serializes cancel versus test payment and refuses duplicate settlement', async () => {
    const f = await fixture(3); const o = await order(f.sku);
    const results = await Promise.all([post(`/orders/${o.id}/cancel`, customer, { version: o.version, reason: '取消' }),
      post(`/admin/orders/${o.id}/test-payment`, full, { version: o.version, transactionNo: randomUUID() })]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    const current = await db.getRepository(Order).findOneByOrFail({ id: o.id });
    expect(['CANCELLED', 'PENDING_SHIPMENT']).toContain(current.status);
    const s = await db.getRepository(Sku).findOneByOrFail({ id: f.sku.id }); expect(s.reservedStock).toBe(current.status === 'CANCELLED' ? 0 : 1);
    await post(`/admin/orders/${o.id}/test-payment`, full, { version: current.version, transactionNo: randomUUID() }).expect(409);
  });
  it('keeps test payments opt-in, permission-gated and unavailable in production', async () => {
    const f = await fixture(); const o = await order(f.sku);
    await post(`/admin/orders/${o.id}/test-payment`, reader, { version: o.version, transactionNo: randomUUID() }).expect(403);
    await post(`/admin/orders/${o.id}/test-payment`, customer, { version: o.version, transactionNo: randomUUID() }).expect(401);
    process.env.COMMERCE_TEST_PAYMENTS = 'false';
    await post(`/admin/orders/${o.id}/test-payment`, full, { version: o.version, transactionNo: randomUUID() }).expect(403);
    process.env.COMMERCE_TEST_PAYMENTS = 'true'; process.env.NODE_ENV = 'production';
    try { await post(`/admin/orders/${o.id}/test-payment`, full, { version: o.version, transactionNo: randomUUID() }).expect(403); }
    finally { process.env.NODE_ENV = 'test'; }
  });
  it('resolves simultaneous shipping and refund-only application without releasing shipped stock', async () => {
    const f = await fixture(5); const o = await paidOrder(f.sku, 2);
    const results = await Promise.all([post(`/admin/orders/${o.id}/shipment`, full, { carrierCode: 'SF', trackingNo: randomUUID(), orderVersion: o.version }),
      post('/aftersales', customer, { orderId: o.id, type: 'REFUND_ONLY', items: [{ orderItemId: o.items[0].id, quantity: 1 }], reasonCode: 'NOT_NEEDED', description: '并发测试' })]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    const s = await db.getRepository(Sku).findOneByOrFail({ id: f.sku.id });
    if (results[0].status === 201) { expect(s.onHandStock).toBe(3); expect(s.reservedStock).toBe(0); }
    else { expect(s.onHandStock).toBe(5); expect(s.reservedStock).toBe(2); }
  });
  it('allows only one active aftersale, freezes shipment and releases only successful partial refunds', async () => {
    const f = await fixture(10); const o = await paidOrder(f.sku, 3);
    const a = await sale(o, 1);
    await post('/aftersales', customer, { orderId: o.id, type: 'REFUND_ONLY', items: [{ orderItemId: o.items[0].id, quantity: 1 }], reasonCode: 'OTHER', description: '重复' }).expect(409);
    const current = data(await call('get', `/orders/${o.id}`, customer).expect(200));
    await post(`/admin/orders/${o.id}/shipment`, full, { carrierCode: 'SF', trackingNo: randomUUID(), orderVersion: current.version }).expect(409);
    const approved = await approve(a); expect(approved.status).toBe('REFUNDING');
    expect((await db.getRepository(Sku).findOneByOrFail({ id: f.sku.id })).reservedStock).toBe(3);
    const key = randomUUID(); const body = { version: approved.version, result: 'SUCCEEDED' };
    const r = data(await post(`/admin/refunds/${approved.refundId}/test-result`, full, body, key).expect(200)); expect(r.status).toBe('SUCCEEDED');
    await post(`/admin/refunds/${approved.refundId}/test-result`, full, body, key).expect(200);
    const partial = data(await call('get', `/orders/${o.id}`, customer).expect(200)); expect(partial.refundedAmountCents).toBe(1200); expect(partial.paymentStatus).toBe('PARTIALLY_REFUNDED');
    const beforeShip = await db.getRepository(Sku).findOneByOrFail({ id: f.sku.id }); expect(beforeShip.reservedStock).toBe(2); expect(beforeShip.onHandStock).toBe(10);
    const shipped = data(await post(`/admin/orders/${o.id}/shipment`, full, { carrierCode: 'SF', trackingNo: randomUUID(), orderVersion: partial.version }).expect(201)); expect(shipped.items[0].quantity).toBe(2);
    const afterShip = await db.getRepository(Sku).findOneByOrFail({ id: f.sku.id }); expect(afterShip.reservedStock).toBe(0); expect(afterShip.onHandStock).toBe(8);
  });
  it('keeps failed refunds frozen and retries the original refund ID', async () => {
    const f = await fixture(3); const o = await paidOrder(f.sku); const a = await approve(await sale(o));
    await post(`/admin/refunds/${a.refundId}/test-result`, full, { version: a.version, result: 'FAILED' }).expect(200);
    const failed = data(await call('get', `/aftersales/${a.id}`, customer).expect(200)); expect(failed.status).toBe('REFUND_FAILED');
    expect((await db.getRepository(Sku).findOneByOrFail({ id: f.sku.id })).reservedStock).toBe(1);
    const retry = data(await post(`/admin/aftersales/${a.id}/retry-refund`, full, { version: failed.version }).expect(200)); expect(retry.refundId).toBe(a.refundId);
    await post(`/admin/refunds/${retry.refundId}/test-result`, full, { version: retry.version, result: 'SUCCEEDED' }).expect(200);
    const closed = data(await call('get', `/orders/${o.id}`, customer).expect(200)); expect(closed.status).toBe('CLOSED'); expect(closed.paymentStatus).toBe('REFUNDED');
    expect(await db.getRepository(Refund).countBy({ afterSaleId: a.id })).toBe(1);
  });
  it('requires return address, shipping and inspection before refund; returned goods do not auto-restock', async () => {
    const f = await fixture(5); const o = await paidOrder(f.sku, 2);
    await post(`/admin/orders/${o.id}/shipment`, full, { carrierCode: 'SF', trackingNo: randomUUID(), orderVersion: o.version }).expect(201);
    const a = await sale(o, 1, 'RETURN_REFUND');
    await post(`/admin/aftersales/${a.id}/review`, full, { decision: 'APPROVE', note: '批准', version: a.version }).expect(400);
    const approved = await approve(a, { returnAddress: snapshot });
    await post(`/admin/aftersales/${a.id}/confirm-return`, full, { version: approved.version, note: '尚未寄回' }).expect(409);
    const returning = data(await post(`/aftersales/${a.id}/return-shipment`, customer, { version: approved.version, carrierCode: 'SF', trackingNo: randomUUID() }).expect(200));
    const inspected = data(await post(`/admin/aftersales/${a.id}/confirm-return`, full, { version: returning.version, note: '验收通过，等待质检入库' }).expect(200));
    await post(`/admin/refunds/${inspected.refundId}/test-result`, full, { version: inspected.version, result: 'SUCCEEDED' }).expect(200);
    const s = await db.getRepository(Sku).findOneByOrFail({ id: f.sku.id }); expect(s.onHandStock).toBe(3); expect(s.reservedStock).toBe(0);
  });
  it('expires unsubmitted return requests and enforces the seven-day application window', async () => {
    const f = await fixture(); const o = await paidOrder(f.sku);
    await post(`/admin/orders/${o.id}/shipment`, full, { carrierCode: 'SF', trackingNo: randomUUID(), orderVersion: o.version }).expect(201);
    const a = await approve(await sale(o, 1, 'RETURN_REFUND'), { returnAddress: snapshot });
    await db.getRepository(AfterSale).update(a.id, { returnDeadlineAt: new Date(Date.now() - 1000) }); await app.get(CommerceMaintenance).sweep();
    expect(data(await call('get', `/aftersales/${a.id}`, customer).expect(200)).status).toBe('CLOSED');
    const current = data(await call('get', `/orders/${o.id}`, customer).expect(200));
    await post(`/orders/${o.id}/confirm-receipt`, customer, { version: current.version }).expect(200);
    await db.getRepository(Order).update(o.id, { completedAt: new Date(Date.now() - 8 * 86400000) });
    await post('/aftersales', customer, { orderId: o.id, type: 'RETURN_REFUND', items: [{ orderItemId: o.items[0].id, quantity: 1 }], reasonCode: 'OTHER', description: '超时' }).expect(409);
  });
  it('tracks manual logistics, restricts corrections after pickup and keeps delivery separate from receipt', async () => {
    const f = await fixture(); const o = await paidOrder(f.sku);
    expect(data(await call('get', `/orders/${o.id}/logistics`, customer).expect(200)).syncStatus).toBe('NOT_SHIPPED');
    const s = data(await post(`/admin/orders/${o.id}/shipment`, full, { carrierCode: 'SF', trackingNo: randomUUID(), orderVersion: o.version }).expect(201));
    const corrected = data(await call('patch', `/admin/shipments/${s.id}`, full, { version: s.version, carrierCode: 'SF', trackingNo: randomUUID(), reason: '录入纠错' }).expect(200));
    const transit = data(await post(`/admin/shipments/${s.id}/events`, full, { version: corrected.version, status: 'IN_TRANSIT', time: new Date().toISOString(), description: '人工登记揽收' }).expect(200));
    await call('patch', `/admin/shipments/${s.id}`, full, { version: transit.version, carrierCode: 'SF', trackingNo: randomUUID(), reason: '已揽收不能改' }).expect(409);
    await post(`/admin/shipments/${s.id}/events`, full, { version: transit.version, status: 'DELIVERED', time: new Date().toISOString(), description: '人工确认签收' }).expect(200);
    expect(data(await call('get', `/orders/${o.id}`, customer).expect(200)).status).toBe('PENDING_RECEIPT');
    const logistics = data(await call('get', `/orders/${o.id}/logistics`, customer).expect(200)); expect(logistics.syncStatus).toBe('MANUAL'); expect(logistics.events).toHaveLength(2); expect(logistics.events[0].source).toBe('MANUAL');
  });
  it('publishes CORS permissions for PATCH and Idempotency-Key without exposing credentials', async () => {
    const r = await api().options('/api/v1/admin/products').set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'PATCH').set('Access-Control-Request-Headers', 'authorization,idempotency-key').expect(204);
    expect(r.headers['access-control-allow-methods']).toContain('PATCH'); expect(r.headers['access-control-allow-headers']).toContain('Idempotency-Key');
    const audit = data(await call('get', '/admin/commerce-audit-logs', full).expect(200)); expect(audit.total).toBeGreaterThan(0);
    expect(JSON.stringify(audit)).not.toContain(password); expect(JSON.stringify(audit)).not.toContain('passwordHash');
  });
  it('preserves omitted patch fields and safely updates a disabled SKU', async () => {
    const f = await fixture();
    const p = data(await call('get', `/admin/products/${f.product.id}`, full).expect(200));
    await call('patch', `/admin/products/${p.id}`, full, { version: p.version }).expect(400);
    const updated = data(await call('patch', `/admin/products/${p.id}`, full, { version: p.version, name: '只改名称' }).expect(200));
    expect(updated.summary).toBe(p.summary); expect(updated.detailHtml).toBe(p.detailHtml); expect(updated.status).toBe('PUBLISHED');
    const disabled = data(await post(`/admin/products/${p.id}/skus`, full, { skuCode: randomUUID(), attributes: [{ name: '规格', value: '停用' }], priceCents: 2300, enabled: false }).expect(201));
    const changed = data(await call('patch', `/admin/skus/${disabled.id}`, full, { version: disabled.version, priceCents: 2400 }).expect(200));
    expect(changed.enabled).toBe(false); expect(changed.attributes).toEqual(disabled.attributes);
    const visible = data(await call('get', `/products/${p.id}`).expect(200)); expect(visible.skus).toHaveLength(1);
  });
  it('snapshots addresses at quote time even after address replacement and deletion', async () => {
    const f = await fixture(); const a = data(await post('/me/addresses', customer, { ...snapshot, isDefault: true }).expect(201));
    const q = data(await post('/order-quotes', customer, { type: 'PRODUCT', addressId: a.id, items: [{ skuId: f.sku.id, quantity: 1 }] }).expect(201));
    const changed = data(await call('put', `/me/addresses/${a.id}`, customer, { ...snapshot, detail: '变更地址', isDefault: true, version: a.version }).expect(200));
    await call('delete', `/me/addresses/${a.id}?version=${changed.version}`, customer).expect(200);
    const o = data(await post('/orders', customer, { quoteId: q.quoteId }).expect(201)); expect(o.address).toEqual(snapshot);
  });
  it('rejects foreign order lines, over-refunds and nonexistent private evidence', async () => {
    const f = await fixture(); const o = await paidOrder(f.sku);
    const body = { orderId: o.id, type: 'REFUND_ONLY', items: [{ orderItemId: o.items[0].id, quantity: 2 }], reasonCode: 'OTHER', description: '边界测试' };
    await post('/aftersales', customer, body).expect(409);
    await post('/aftersales', customer, { ...body, items: [{ orderItemId: randomUUID(), quantity: 1 }] }).expect(404);
    await post('/aftersales', customer, { ...body, refundAmountCents: 1 }).expect(400);
    await post('/aftersales', customer, { ...body, items: [{ orderItemId: o.items[0].id, quantity: 1 }], evidenceMediaIds: [randomUUID()] }).expect(404);
    const a = await approve(await sale(o));
    await post(`/admin/refunds/${a.refundId}/test-result`, reader, { version: a.version, result: 'SUCCEEDED' }).expect(403);
    await post(`/admin/refunds/${a.refundId}/test-result`, full, { version: a.version, result: 'SUCCEEDED' }).expect(200);
    const completed = data(await call('get', `/aftersales/${a.id}`, customer).expect(200));
    await post(`/admin/refunds/${a.refundId}/test-result`, full, { version: completed.version, result: 'SUCCEEDED' }).expect(409);
    await post('/aftersales', customer, { ...body, items: [{ orderItemId: o.items[0].id, quantity: 1 }] }).expect(409);
  });
  it('unfreezes rejected and cancelled aftersales while preserving the paid reservation', async () => {
    const f = await fixture(5); const o = await paidOrder(f.sku, 2); const a = await sale(o);
    await post(`/admin/aftersales/${a.id}/review`, full, { version: a.version, decision: 'REJECT', note: '需要补充说明' }).expect(200);
    const again = await sale(o); await post(`/aftersales/${again.id}/cancel`, customer, { version: again.version }).expect(200);
    const current = data(await call('get', `/orders/${o.id}`, customer).expect(200)); expect(current.afterSaleStatus).toBe('NONE');
    expect((await db.getRepository(Sku).findOneByOrFail({ id: f.sku.id })).reservedStock).toBe(2);
    await post(`/admin/orders/${o.id}/shipment`, full, { carrierCode: 'SF', trackingNo: randomUUID(), orderVersion: current.version }).expect(201);
  });
  it('protects payment ledger uniqueness and commits no order change when a transaction number is reused', async () => {
    const f = await fixture(); const a = await order(f.sku), b = await order(f.sku); const transactionNo = randomUUID(); const key = randomUUID();
    await post(`/admin/orders/${a.id}/test-payment`, full, { version: a.version, transactionNo }, key).expect(200);
    await post(`/admin/orders/${a.id}/test-payment`, full, { version: a.version, transactionNo }, key).expect(200);
    await post(`/admin/orders/${b.id}/test-payment`, full, { version: b.version, transactionNo }).expect(409);
    const current = await db.getRepository(Order).findOneByOrFail({ id: b.id }); expect(current.status).toBe('PENDING_PAYMENT'); expect(current.paidAmountCents).toBe(0);
  });
});
