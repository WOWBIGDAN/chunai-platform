import 'reflect-metadata';
import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { setupApp } from '../../src/setup-app';
import { PasswordService } from '../../src/auth/password.service';
import { AdminAccount, Order } from '../../src/commerce/entities';
import { Content, CourseEntitlement } from '../../src/content/entities';
import { PERMISSIONS } from '../../src/commerce/permissions';

if (!process.env.TEST_DB_NAME || !/^[A-Za-z0-9_]+_test$/.test(process.env.TEST_DB_NAME) || !process.env.TEST_DB_PASSWORD) throw new Error('Content E2E requires an isolated _test database');
Object.assign(process.env, { NODE_ENV: 'test', DB_HOST: process.env.TEST_DB_HOST ?? '127.0.0.1', DB_PORT: process.env.TEST_DB_PORT ?? '3306',
  DB_USER: process.env.TEST_DB_USER ?? 'chunai_test', DB_PASSWORD: process.env.TEST_DB_PASSWORD, DB_NAME: process.env.TEST_DB_NAME,
  JWT_SECRET: randomBytes(48).toString('hex'), TERMS_VERSION: '2026-10-01', PRIVACY_VERSION: '2026-10-01', COMMERCE_TEST_PAYMENTS: 'true',
  CONTENT_MEDIA_DIR: resolve('.tmp/content-e2e-media'), PUBLIC_API_URL: 'http://localhost:3000/api/v1' });

describe('content, paid access, columns and protected video with real MySQL', () => {
  let app: INestApplication, db: DataSource;
  let admin: any, reader: any, editor: any, customer: any, stranger: any, category: any, cover: any, columnCover: any, video: any;
  const admins: string[] = [], users: string[] = [], contentIds: string[] = [], columns: string[] = [], mediaIds: string[] = [], categories: string[] = [];
  const responses: { method: string; path: string; status: number; data: unknown }[] = [];
  const password = 'csContentTestPassword#123';
  let phone = 17000000000 + Math.floor(Math.random() * 100000000);
  const call = (method: 'get' | 'post' | 'patch' | 'put' | 'delete', path: string, who?: any, body?: any, key?: string) => {
    let req = request(app.getHttpServer())[method](`/api/v1${path}`);
    if (who) req = req.auth(who.accessToken, { type: 'bearer' });
    if (key) req = req.set('Idempotency-Key', key);
    req.on('response', (r: request.Response) => {
      if (r.status >= 200 && r.status < 300 && r.body?.data && !path.includes('/auth/')) responses.push({ method, path: path.split('?')[0], status: r.status, data: r.body.data });
    });
    return body === undefined ? req : req.send(body);
  };
  const data = (r: request.Response) => r.body.data;
  const post = (path: string, who: any, body: any, key = randomUUID()) => call('post', path, who, body, key);
  const assertCode = (code: string) => (r: request.Response) => expect(r.body.code).toBe(code);
  async function account(permissions: readonly string[]) {
    const id = randomUUID(), username = `cs_${id}`;
    await db.getRepository(AdminAccount).save({ id, username, displayName: 'cs测试管理员', passwordHash: await new PasswordService().hash(password), enabled: true, permissions: [...permissions], version: 1 });
    admins.push(id); return { ...data(await post('/admin/auth/login', null, { username, password }).expect(200)), id };
  }
  async function user() {
    const u = data(await post('/auth/register', null, { phone: `+86${++phone}`, password, termsVersion: '2026-10-01', privacyVersion: '2026-10-01' }).expect(201));
    users.push(u.user.id); return u;
  }
  async function image(purpose: string) {
    const v = data(await post('/admin/content-media/images', admin, { purpose, publicUrl: 'https://example.com/cs.png', mimeType: 'image/png', sizeBytes: 1024 }).expect(201));
    mediaIds.push(v.id); return v;
  }
  async function create(kind = 'ARTICLE_COURSE', extra = {}) {
    const c = data(await post('/admin/contents', admin, { kind, title: `cs ${randomUUID()}`, summary: 'cs测试内容', coverMediaId: cover.id,
      categoryId: category.id, descriptionHtml: '<p onclick="bad()">介绍<script>bad()</script></p>', authorName: 'cs编辑', tags: ['cs'],
      accessPolicy: kind.endsWith('COURSE') ? 'PURCHASE' : 'FREE', priceCents: kind.endsWith('COURSE') ? 1990 : 0, ...extra }).expect(201));
    contentIds.push(c.id); return c;
  }
  async function chapter(course: any, preview = false, publish = true) {
    let ch = data(await post(`/admin/courses/${course.id}/chapters`, admin, { title: preview ? 'cs预览章' : 'cs付费章', sortOrder: preview ? 0 : 1, isPreview: preview }).expect(201));
    const saved = data(await call('put', `/admin/chapters/${ch.id}/body`, admin, { version: ch.version, ...(course.kind === 'VIDEO_COURSE' ? { videoMediaId: video.id } : { bodyHtml: '<p onclick="bad()">cs受保护正文<script>bad()</script></p>', imageMediaIds: [] }) }).expect(200));
    ch.version = saved.version;
    if (publish) ch = data(await post(`/admin/chapters/${ch.id}/publish`, admin, { version: ch.version }).expect(200));
    return ch;
  }
  async function fixture(kind = 'ARTICLE_COURSE') {
    let c = await create(kind); let preview: any, paid: any;
    if (kind.endsWith('COURSE')) { preview = await chapter(c, true); paid = await chapter(c); }
    else {
      const b = data(await call('put', `/admin/contents/${c.id}/body`, admin, { version: c.version, ...(kind === 'SCIENCE_VIDEO' ? { videoMediaId: video.id } : { bodyHtml: '<p>cs免费科普正文</p>', imageMediaIds: [] }) }).expect(200)); c.version = b.version;
    }
    c = data(await post(`/admin/contents/${c.id}/publish`, admin, { version: c.version }).expect(200)); return { c, preview, paid };
  }
  async function quote(c: any, who = customer) { return data(await post('/order-quotes', who, { type: 'COURSE', courseId: c.id }).expect(201)); }
  async function order(c: any, who = customer) { const q = await quote(c, who); return data(await post('/orders', who, { quoteId: q.quoteId }).expect(201)); }
  async function pay(o: any) { return data(await post(`/admin/orders/${o.id}/test-payment`, admin, { version: o.version, transactionNo: randomUUID() }).expect(200)); }
  async function refund(o: any, result = 'SUCCEEDED') {
    const r = data(await post(`/admin/orders/${o.id}/digital-refund`, admin, { orderVersion: o.version, reason: 'cs退款测试' }).expect(202));
    return data(await post(`/admin/refunds/${r.id}/test-result`, admin, { version: r.version, result }).expect(200));
  }
  function play(url: string, range?: string) {
    const parsed = new URL(url); let req = request(app.getHttpServer()).get(parsed.pathname + parsed.search);
    if (range) req = req.set('Range', range); return req;
  }
  beforeAll(async () => {
    const { AppModule } = await import('../../src/app.module');
    const mod = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(ThrottlerGuard).useValue({ canActivate: () => true }).compile();
    app = mod.createNestApplication({ bodyParser: false }); setupApp(app); db = app.get(DataSource); await db.runMigrations(); await app.init();
    admin = await account(PERMISSIONS); reader = await account(['orders:read']); editor = await account(['content:write']); customer = await user(); stranger = await user();
    category = data(await post('/admin/categories', admin, { name: 'cs内容分类', scope: 'CONTENT' }).expect(201)); categories.push(category.id);
    cover = await image('CONTENT_COVER'); columnCover = await image('COLUMN_COVER');
    const r = await request(app.getHttpServer()).post('/api/v1/admin/content-media/videos?durationSeconds=3').auth(admin.accessToken, { type: 'bearer' }).set('Content-Type', 'video/mp4').send(readFileSync('database/seeds/cs-sample.mp4')).expect(201);
    video = data(r); mediaIds.push(video.id);
  }, 120000);
  afterAll(async () => {
    mkdirSync('.tmp', { recursive: true }); writeFileSync('.tmp/content-contract-responses.json', JSON.stringify(responses));
    if (db?.isInitialized) {
      for (const id of users) {
        const orders = 'SELECT id FROM commerce_orders WHERE user_id = ?';
        for (const sql of ['DELETE FROM course_entitlements WHERE user_id = ?', `DELETE FROM refunds WHERE order_id IN (${orders})`, `DELETE FROM payment_records WHERE order_id IN (${orders})`,
          `DELETE FROM order_items WHERE order_id IN (${orders})`, 'DELETE FROM commerce_orders WHERE user_id = ?', 'DELETE FROM order_quotes WHERE user_id = ?']) await db.query(sql, [id]);
      }
      for (const id of columns) { await db.query('DELETE FROM column_contents WHERE column_id = ?', [id]); await db.query('DELETE FROM content_columns WHERE id = ?', [id]); }
      for (const id of contentIds) { await db.query('DELETE FROM course_chapters WHERE course_id = ?', [id]); await db.query('DELETE FROM contents WHERE id = ?', [id]); }
      for (const id of mediaIds) { await db.query('DELETE FROM content_media WHERE id = ?', [id]); await unlink(resolve(process.env.CONTENT_MEDIA_DIR!, `${id}.mp4`)).catch(() => {}); }
      for (const id of categories.reverse()) await db.query('DELETE FROM product_categories WHERE id = ?', [id]);
      for (const [kind, ids] of [['user', users], ['admin', admins]] as const) for (const id of ids) {
        await db.query('DELETE FROM idempotency_records WHERE actor_key = ?', [`${kind}:${id}`]); await db.query('DELETE FROM commerce_audit_logs WHERE actor_key = ?', [`${kind}:${id}`]);
        await db.query(`DELETE FROM ${kind === 'user' ? 'users' : 'admin_accounts'} WHERE id = ?`, [id]);
      }
    }
    if (app) await app.close();
  });

  it('separates customer/admin tokens and checks content permission for all management entry points', async () => {
    await call('get', '/admin/contents').expect(401); await call('get', '/admin/contents', customer).expect(401);
    await call('get', '/admin/contents', reader).expect(403); await call('get', '/admin/columns', reader).expect(403);
    await call('get', '/admin/contents', editor).expect(200); await call('get', '/me/courses', admin).expect(401);
    await call('get', '/articles', { accessToken: 'invalid' }).expect(401);
  });
  it('enforces category scope and blocks referenced category deletion', async () => {
    const product = data(await post('/admin/categories', admin, { name: 'cs产品分类', scope: 'PRODUCT' }).expect(201)); categories.push(product.id);
    await post('/admin/categories', admin, { name: 'cs错域', scope: 'CONTENT', parentId: product.id }).expect(409);
    const c = await create();
    await call('patch', `/admin/contents/${c.id}`, admin, { version: c.version, categoryId: product.id }).expect(409);
    await call('delete', `/admin/categories/${category.id}?version=${category.version}`, admin).expect(409);
    const listed = data(await call('get', '/categories?scope=CONTENT').expect(200)); expect(listed.items.every((x: any) => x.scope === 'CONTENT')).toBe(true);
  });
  it('validates free science, paired price changes, immutable kind and media purpose', async () => {
    const dto = { kind: 'SCIENCE_ARTICLE', title: 'cs非法', summary: '', categoryId: category.id, coverMediaId: cover.id, accessPolicy: 'PURCHASE', priceCents: 100 };
    await post('/admin/contents', admin, dto).expect(400);
    await post('/admin/contents', admin, { ...dto, accessPolicy: 'MEMBER_OR_PURCHASE' }).expect(400);
    const c = await create();
    await call('patch', `/admin/contents/${c.id}`, admin, { version: c.version, priceCents: 10 }).expect(400);
    await call('patch', `/admin/contents/${c.id}`, admin, { version: c.version, kind: 'SCIENCE_VIDEO' }).expect(400);
    await call('patch', `/admin/contents/${c.id}`, admin, { version: c.version, coverMediaId: columnCover.id }).expect(409);
  });
  it('hides drafts and refuses publishing missing bodies or an empty course', async () => {
    const c = await create(); await call('get', `/articles/${c.id}`).expect(404);
    await post(`/admin/contents/${c.id}/publish`, admin, { version: c.version }).expect(409);
    const s = await create('SCIENCE_ARTICLE'); await post(`/admin/contents/${s.id}/publish`, admin, { version: s.version }).expect(409);
    const ch = data(await post(`/admin/courses/${c.id}/chapters`, admin, { title: 'cs空章', sortOrder: 0 }).expect(201));
    await post(`/admin/chapters/${ch.id}/publish`, admin, { version: ch.version }).expect(409);
  });
  it('sanitizes HTML, validates images, rejects mixed bodies and stale versions', async () => {
    const c = await create('SCIENCE_ARTICLE'); expect(c.descriptionHtml).not.toMatch(/onclick|script/);
    await call('put', `/admin/contents/${c.id}/body`, admin, { version: c.version, bodyHtml: '<script>x</script>', imageMediaIds: [] }).expect(400);
    await call('put', `/admin/contents/${c.id}/body`, admin, { version: c.version, bodyHtml: '<img src="https://evil.invalid/a">', imageMediaIds: [] }).expect(400);
    await call('put', `/admin/contents/${c.id}/body`, admin, { version: c.version, bodyHtml: 'x', imageMediaIds: [], videoMediaId: video.id }).expect(400);
    const img = await image('CONTENT_BODY_IMAGE');
    const b = data(await call('put', `/admin/contents/${c.id}/body`, admin, { version: c.version, bodyHtml: '<p onclick="x()">cs正文</p><img src="https://example.com/cs.png" onerror="x()">', imageMediaIds: [img.id] }).expect(200));
    expect(b.bodyHtml).not.toMatch(/onclick|onerror/);
    await call('patch', `/admin/contents/${c.id}`, admin, { version: c.version, title: 'cs过期版本' }).expect(409).expect(assertCode('VERSION_CONFLICT'));
    await post(`/admin/contents/${c.id}/publish`, admin, { version: b.version }).expect(200);
    const body = data(await call('get', `/articles/${c.id}/body`).expect(200)); expect(body.imageUrls).toEqual(['https://example.com/cs.png']);
  });
  it('allows anonymous science and preview but never leaks paid body or media in metadata', async () => {
    const { c: science } = await fixture('SCIENCE_ARTICLE'); await call('get', `/articles/${science.id}/body`).expect(200);
    const { c, preview, paid } = await fixture();
    await call('get', `/chapters/${preview.id}/body`).expect(200);
    await call('get', `/chapters/${paid.id}/body`).expect(401).expect(assertCode('AUTH_REQUIRED'));
    await call('get', `/chapters/${paid.id}/body`, customer).expect(403).expect(assertCode('CONTENT_ACCESS_DENIED'));
    for (const path of [`/articles/${c.id}`, `/courses/${c.id}/chapters`, '/articles?kind=ARTICLE_COURSE']) {
      const r = await call('get', path).expect(200); expect(JSON.stringify(r.body)).not.toMatch(/bodyHtml|videoMediaId|storageKey|受保护正文/);
    }
    await call('get', `/articles/${c.id}/body`, customer).expect(404); await call('get', `/videos/${c.id}`).expect(404);
  });
  it('grants course access atomically with payment and keeps customer ownership isolated', async () => {
    const { c, paid } = await fixture(); const o = await order(c);
    expect(o.type).toBe('COURSE'); expect(o.address).toBeNull(); expect(o.shippingFeeCents).toBe(0); expect(o.items[0].resourceType).toBe('COURSE');
    await call('get', `/orders/${o.id}`, stranger).expect(404); await call('get', `/chapters/${paid.id}/body`, customer).expect(403);
    await post(`/admin/orders/${o.id}/test-payment`, editor, { version: o.version, transactionNo: randomUUID() }).expect(403);
    const settled = await pay(o); expect(settled.status).toBe('COMPLETED'); expect(settled.actions.canApplyAfterSale).toBe(false);
    await call('get', `/chapters/${paid.id}/body`, customer).expect(200); await call('get', `/chapters/${paid.id}/body`, stranger).expect(403);
    const own = data(await call('get', '/me/courses?status=ACTIVE', customer).expect(200)); expect(own.items.some((x: any) => x.course.id === c.id)).toBe(true);
    const other = data(await call('get', '/me/courses', stranger).expect(200)); expect(other.items.some((x: any) => x.course.id === c.id)).toBe(false);
    await post('/order-quotes', customer, { type: 'COURSE', courseId: c.id }).expect(409).expect(assertCode('COURSE_ALREADY_PURCHASED'));
    await post(`/admin/orders/${o.id}/shipment`, admin, { orderVersion: settled.version, carrierCode: 'SF', trackingNo: 'cs123' }).expect(409);
    await post('/aftersales', customer, { orderId: o.id, type: 'REFUND_ONLY', items: [{ orderItemId: o.items[0].id, quantity: 1 }], reasonCode: 'OTHER', description: 'cs数字订单' }).expect(409);
  });
  it('deduplicates concurrent course orders and repeat payment requests', async () => {
    const { c } = await fixture(); const [q1, q2] = await Promise.all([quote(c), quote(c)]);
    const results = await Promise.all([post('/orders', customer, { quoteId: q1.quoteId }), post('/orders', customer, { quoteId: q2.quoteId })]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]); const o = data(results.find(r => r.status === 201)!);
    const key = randomUUID(), body = { version: o.version, transactionNo: randomUUID() };
    const paid = await Promise.all([post(`/admin/orders/${o.id}/test-payment`, admin, body, key), post(`/admin/orders/${o.id}/test-payment`, admin, body, key)]);
    expect(paid.map(r => r.status)).toEqual([200, 200]); expect(await db.manager.countBy(CourseEntitlement, { orderId: o.id })).toBe(1);
  });
  it('rejects mixed purchase payloads, foreign quotes, changed prices and expired quotes', async () => {
    const { c } = await fixture(); const q = await quote(c);
    await post('/order-quotes', customer, { type: 'COURSE', courseId: c.id, addressId: randomUUID() }).expect(400);
    await post('/order-quotes', customer, { type: 'COURSE', courseId: c.id, priceCents: 1 }).expect(400);
    await post('/orders', stranger, { quoteId: q.quoteId }).expect(404);
    await call('patch', `/admin/contents/${c.id}`, admin, { version: c.version, accessPolicy: 'PURCHASE', priceCents: 2990 }).expect(200);
    await post('/orders', customer, { quoteId: q.quoteId }).expect(409).expect(assertCode('QUOTE_CHANGED'));
    const fresh = await quote(c); await db.query('UPDATE order_quotes SET expires_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 MINUTE) WHERE id = ?', [fresh.quoteId]);
    await post('/orders', customer, { quoteId: fresh.quoteId }).expect(409).expect(assertCode('QUOTE_EXPIRED'));
  });
  it('cancels and expires digital orders without touching SKU stock', async () => {
    const { c } = await fixture(); const o = await order(c);
    await post(`/orders/${o.id}/cancel`, customer, { version: o.version, reason: 'cs取消' }).expect(200);
    await post(`/admin/orders/${o.id}/test-payment`, admin, { version: 2, transactionNo: randomUUID() }).expect(409);
    const next = await order(c); await db.manager.update(Order, next.id, { paymentDeadlineAt: new Date(Date.now() - 1000) });
    expect(data(await call('get', `/orders/${next.id}`, customer).expect(200)).status).toBe('CANCELLED');
    expect(await db.manager.countBy(CourseEntitlement, { orderId: next.id })).toBe(0);
  });
  it('retains purchased offline chapters, hides drafts and stops new sales', async () => {
    const { c, paid } = await fixture(); await pay(await order(c)); const draft = await chapter(c, false, false);
    await post(`/admin/chapters/${paid.id}/unpublish`, admin, { version: paid.version }).expect(200);
    await post(`/admin/contents/${c.id}/unpublish`, admin, { version: c.version }).expect(200);
    await call('get', `/articles/${c.id}`).expect(404); await call('get', `/articles/${c.id}`, customer).expect(200);
    await call('get', `/chapters/${paid.id}/body`, customer).expect(200); await call('get', `/chapters/${draft.id}/body`, customer).expect(404);
    const chapters = data(await call('get', `/courses/${c.id}/chapters`, customer).expect(200)); expect(chapters.items.some((x: any) => x.id === paid.id)).toBe(true); expect(chapters.items.some((x: any) => x.id === draft.id)).toBe(false);
    await post('/order-quotes', stranger, { type: 'COURSE', courseId: c.id }).expect(409);
    await call('delete', `/admin/contents/${c.id}?version=${c.version + 1}`, admin).expect(409);
    await call('delete', `/admin/chapters/${draft.id}?version=${draft.version}`, admin).expect(409);
  });
  it('automatically unpublishes a course when its last published chapter is removed from sale', async () => {
    let c = await create(); const ch = await chapter(c);
    c = data(await post(`/admin/contents/${c.id}/publish`, admin, { version: c.version }).expect(200));
    await post(`/admin/chapters/${ch.id}/unpublish`, admin, { version: ch.version }).expect(200);
    expect(data(await call('get', `/admin/contents/${c.id}`, admin).expect(200)).status).toBe('OFFLINE');
    await call('get', `/articles/${c.id}`).expect(404);
  });
  it('revokes only the refunded order entitlement and permits a later repurchase', async () => {
    const { c, paid } = await fixture(); const settled = await pay(await order(c));
    const r = await refund(settled); expect(r.reasonType).toBe('DIGITAL_ORDER');
    await call('get', `/chapters/${paid.id}/body`, customer).expect(403);
    expect(data(await call('get', `/orders/${settled.id}`, customer).expect(200)).status).toBe('CLOSED');
    const next = await pay(await order(c)); await call('get', `/chapters/${paid.id}/body`, customer).expect(200);
    const entries = await db.manager.findBy(CourseEntitlement, { userId: customer.user.id, courseId: c.id });
    expect(entries.filter(e => e.status === 'ACTIVE').map(e => e.orderId)).toEqual([next.id]);
  });
  it('keeps access on failed refunds, retries the same refund and rejects stale result versions', async () => {
    const { c, paid } = await fixture(); const settled = await pay(await order(c)); const failed = await refund(settled, 'FAILED');
    await call('get', `/chapters/${paid.id}/body`, customer).expect(200);
    const current = data(await call('get', `/admin/orders/${settled.id}`, admin).expect(200));
    const retried = data(await post(`/admin/orders/${settled.id}/digital-refund`, admin, { orderVersion: current.version, reason: 'cs重试' }).expect(202)); expect(retried.id).toBe(failed.id);
    await post(`/admin/refunds/${retried.id}/test-result`, admin, { version: failed.version, result: 'SUCCEEDED' }).expect(409);
    await post(`/admin/refunds/${retried.id}/test-result`, admin, { version: retried.version, result: 'SUCCEEDED' }).expect(200);
    await call('get', `/chapters/${paid.id}/body`, customer).expect(403);
  });
  it('columns support ordering, visibility, idempotent links and do not grant paid access', async () => {
    const { c, paid } = await fixture(); const draft = await create('SCIENCE_ARTICLE');
    let col = data(await post('/admin/columns', admin, { name: 'cs专栏测试', coverMediaId: columnCover.id, sortOrder: 2 }).expect(201)); columns.push(col.id);
    await call('get', `/columns/${col.id}`).expect(404);
    for (const id of [c.id, draft.id]) await call('put', `/admin/columns/${col.id}/contents/${id}`, admin, { sortOrder: 1 }).expect(200);
    const current = data(await call('get', `/admin/columns/${col.id}`, admin).expect(200));
    await call('put', `/admin/columns/${col.id}/contents/${c.id}`, admin, { sortOrder: 1 }).expect(200);
    expect(data(await call('get', `/admin/columns/${col.id}`, admin).expect(200)).version).toBe(current.version);
    col = data(await post(`/admin/columns/${col.id}/publish`, admin, { version: current.version }).expect(200));
    expect(data(await call('get', `/columns/${col.id}/contents`).expect(200)).items.map((x: any) => x.id)).toEqual([c.id]);
    expect(data(await call('get', `/columns/${col.id}`).expect(200)).contentCount).toBe(1);
    expect(data(await call('get', `/admin/columns/${col.id}/contents`, admin).expect(200)).total).toBe(2);
    await call('get', `/chapters/${paid.id}/body`, customer).expect(403);
    await call('delete', `/admin/columns/${col.id}?version=${col.version}`, admin).expect(409);
    await call('delete', `/admin/columns/${col.id}/contents/${draft.id}`, admin).expect(200);
    const updated = data(await call('get', `/admin/columns/${col.id}`, admin).expect(200));
    const off = data(await post(`/admin/columns/${col.id}/unpublish`, admin, { version: updated.version }).expect(200));
    await call('delete', `/admin/columns/${col.id}?version=${off.version}`, admin).expect(200);
    await call('get', `/articles/${c.id}`).expect(200);
  });
  it('deletes unused drafts and supports chapter and column editing with optimistic versions', async () => {
    const c = await create(); const ch = await chapter(c, false, false);
    const edited = data(await call('patch', `/admin/chapters/${ch.id}`, admin, { version: ch.version, title: 'cs修改章', sortOrder: 5 }).expect(200));
    await call('delete', `/admin/chapters/${ch.id}?version=${edited.version}`, admin).expect(200);
    await call('delete', `/admin/contents/${c.id}?version=${c.version}`, admin).expect(200);
    const col = data(await post('/admin/columns', admin, { name: 'cs删除栏', coverMediaId: columnCover.id }).expect(201)); columns.push(col.id);
    const changed = data(await call('patch', `/admin/columns/${col.id}`, admin, { version: col.version, name: 'cs已修改栏' }).expect(200));
    await call('delete', `/admin/columns/${col.id}?version=${changed.version}`, admin).expect(200);
  });
  it('serves actual private MP4 bytes with ranges and prevents raw media access and grant tampering', async () => {
    expect(video.publicUrl).toBeNull(); const { c } = await fixture('SCIENCE_VIDEO');
    const grant = data(await call('get', `/videos/${c.id}/playback`).expect(200));
    await play(grant.playbackUrl).expect(200).expect('Content-Type', 'video/mp4');
    await play(grant.playbackUrl, 'bytes=0-15').expect(206).expect('Content-Length', '16');
    await play(grant.playbackUrl, 'bytes=-8').expect(206).expect('Content-Length', '8');
    await play(grant.playbackUrl, 'bytes=99999999-').expect(416);
    await call('get', `/content-playback/${video.id}`).expect(400);
    const url = new URL(grant.playbackUrl); const token = url.searchParams.get('token')!;
    await call('get', `/content-playback/${video.id}?token=${token.slice(0, -8)}AAAAAAAA`).expect(401);
    await call('get', `/content-playback/${randomUUID()}?token=${token}`).expect(401);
    await post(`/admin/contents/${c.id}/unpublish`, admin, { version: c.version }).expect(200);
    await play(grant.playbackUrl).expect(404);
  });
  it('revokes an issued paid video grant on successful refund', async () => {
    const { c, preview, paid } = await fixture('VIDEO_COURSE');
    expect(data(await call('get', `/chapters/${preview.id}/playback`).expect(200)).preview).toBe(true);
    await call('get', `/chapters/${paid.id}/playback`).expect(401); await call('get', `/chapters/${paid.id}/playback`, customer).expect(403);
    const settled = await pay(await order(c)); const grant = data(await call('get', `/chapters/${paid.id}/playback`, customer).expect(200));
    await play(grant.playbackUrl, 'bytes=0-11').expect(206); await refund(settled); await play(grant.playbackUrl).expect(403);
  });
  it('binds preview/admin grants to live sessions and permissions, with a separate JWT audience', async () => {
    const c = await create('SCIENCE_VIDEO'); const b = data(await call('put', `/admin/contents/${c.id}/body`, editor, { version: c.version, videoMediaId: video.id }).expect(200));
    const grant = data(await call('get', `/admin/contents/${c.id}/playback`, editor).expect(200)); await play(grant.playbackUrl).expect(200);
    const token = new URL(grant.playbackUrl).searchParams.get('token')!;
    await call('get', '/admin/contents', { accessToken: token }).expect(401);
    await db.manager.update(AdminAccount, editor.id, { permissions: [] }); await play(grant.playbackUrl).expect(401);
    await db.manager.update(AdminAccount, editor.id, { permissions: ['content:write'] });
    const { preview } = await fixture('VIDEO_COURSE'); const temporary = await user();
    const previewGrant = data(await call('get', `/chapters/${preview.id}/playback`, temporary).expect(200));
    await post('/auth/logout', temporary, {}).expect(200); await play(previewGrant.playbackUrl).expect(401);
    const decoded = new JwtService().decode(token) as any;
    const expired = new JwtService().sign({ ...decoded, exp: Math.floor(Date.now() / 1000) - 1 }, { secret: process.env.JWT_SECRET, algorithm: 'HS256' });
    await call('get', `/content-playback/${video.id}?token=${expired}`).expect(401); expect(b.version).toBe(2);
  });
  it('rejects invalid video uploads and content writes without permission', async () => {
    const upload = () => request(app.getHttpServer()).post('/api/v1/admin/content-media/videos?durationSeconds=3');
    await upload().set('Content-Type', 'video/mp4').send(Buffer.alloc(30)).expect(401);
    await upload().auth(reader.accessToken, { type: 'bearer' }).set('Content-Type', 'video/mp4').send(Buffer.alloc(30)).expect(403);
    await upload().auth(admin.accessToken, { type: 'bearer' }).set('Content-Type', 'video/mp4').send(Buffer.alloc(30)).expect(400);
    await upload().auth(admin.accessToken, { type: 'bearer' }).set('Content-Type', 'text/plain').send('cs').expect(415);
  });
  it('test payment switches remain enforced for digital orders', async () => {
    const { c } = await fixture(); const o = await order(c); const before = process.env.COMMERCE_TEST_PAYMENTS;
    process.env.COMMERCE_TEST_PAYMENTS = 'false';
    try { await post(`/admin/orders/${o.id}/test-payment`, admin, { version: o.version, transactionNo: randomUUID() }).expect(403); }
    finally { process.env.COMMERCE_TEST_PAYMENTS = before; }
    expect(await db.manager.countBy(CourseEntitlement, { orderId: o.id })).toBe(0);
  });
});
