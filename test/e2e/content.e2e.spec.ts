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
import { SplitContentCategories1793404800000, legacyCourseCategoryId } from '../../src/database/migrations/1793404800000-SplitContentCategories';

if (!process.env.TEST_DB_NAME || !/^[A-Za-z0-9_]+_test$/.test(process.env.TEST_DB_NAME) || !process.env.TEST_DB_PASSWORD) throw new Error('Content E2E requires an isolated _test database');
Object.assign(process.env, { NODE_ENV: 'test', DB_HOST: process.env.TEST_DB_HOST ?? '127.0.0.1', DB_PORT: process.env.TEST_DB_PORT ?? '3306',
  DB_USER: process.env.TEST_DB_USER ?? 'chunai_test', DB_PASSWORD: process.env.TEST_DB_PASSWORD, DB_NAME: process.env.TEST_DB_NAME,
  JWT_SECRET: randomBytes(48).toString('hex'), TERMS_VERSION: '2026-10-01', PRIVACY_VERSION: '2026-10-01', COMMERCE_TEST_PAYMENTS: 'true',
  CONTENT_MEDIA_ENCRYPTION_KEY: randomBytes(32).toString('base64'), CONTENT_IMAGE_OSS_HOST: 'chunai-photo.oss-cn-hangzhou.aliyuncs.com',
  CONTENT_MEDIA_DIR: resolve('.tmp/content-e2e-media'), PUBLIC_API_URL: 'http://localhost:3000/api/v1' });

describe('content, paid access, columns and protected video with real MySQL', () => {
  let app: INestApplication, db: DataSource;
  let admin: any, reader: any, editor: any, customer: any, stranger: any, category: any, scienceCategory: any, cover: any, columnCover: any, video: any;
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
    const v = data(await post('/admin/content-media/images', admin, { purpose, publicUrl: purpose === 'CONTENT_BODY_IMAGE' ? 'https://example.com/cs.png' : 'https://chunai-photo.oss-cn-hangzhou.aliyuncs.com/cs.png', mimeType: 'image/png', sizeBytes: 1024 }).expect(201));
    mediaIds.push(v.id); return v;
  }
  async function create(kind = 'ARTICLE_COURSE', extra = {}) {
    const c = data(await post('/admin/contents', admin, { kind, title: `cs ${randomUUID()}`, summary: 'cs测试内容', coverMediaId: cover.id,
      categoryId: (kind.endsWith('COURSE') ? category : scienceCategory).id, descriptionHtml: '<p onclick="bad()">介绍<script>bad()</script></p>', authorName: 'cs编辑', tags: ['cs'],
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
  const memberTerm = (version = 0, extra = {}) => ({ version, startsAt: new Date(Date.now() - 60000).toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(), reason: 'cs会员测试', ...extra });
  async function external(provider = 'FEISHU') {
    const v = data(await post('/admin/content-media/external-videos', admin, { provider, durationSeconds: 60,
      externalUrl: provider === 'FEISHU' ? 'https://cs-test.feishu.cn/file/csTestFileToken' : 'https://www.bilibili.com/video/BV1xx411c7mD/',
      ...(provider === 'FEISHU' ? { accessPassword: 'csFilePassword' } : {}) }).expect(201));
    mediaIds.push(v.id); return v;
  }
  async function memberVideo() {
    let c = await create('VIDEO_COURSE', { accessPolicy: 'MEMBER', priceCents: 0 }); const source = await external();
    let ch = data(await post(`/admin/courses/${c.id}/chapters`, admin, { title: 'cs会员视频章', sortOrder: 0 }).expect(201));
    ch.version = data(await call('put', `/admin/chapters/${ch.id}/body`, admin, { version: ch.version, videoMediaId: source.id }).expect(200)).version;
    ch = data(await post(`/admin/chapters/${ch.id}/publish`, admin, { version: ch.version }).expect(200));
    c = data(await post(`/admin/contents/${c.id}/publish`, admin, { version: c.version }).expect(200)); return { c, ch, source };
  }
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
    category = data(await post('/admin/categories', admin, { name: 'cs课程分类', scope: 'COURSE' }).expect(201)); categories.push(category.id);
    scienceCategory = data(await post('/admin/categories', admin, { name: 'cs科普分类', scope: 'SCIENCE' }).expect(201)); categories.push(scienceCategory.id);
    cover = await image('CONTENT_COVER'); columnCover = await image('COLUMN_COVER');
    const r = await request(app.getHttpServer()).post('/api/v1/admin/content-media/videos?durationSeconds=3').auth(admin.accessToken, { type: 'bearer' }).set('Content-Type', 'video/mp4').send(readFileSync('database/seeds/cs-sample.mp4')).expect(201);
    video = data(r); mediaIds.push(video.id);
  }, 120000);
  afterAll(async () => {
    mkdirSync('.tmp', { recursive: true }); writeFileSync('.tmp/content-contract-responses.json', JSON.stringify(responses));
    if (db?.isInitialized) {
      for (const id of users) {
        await db.query('DELETE FROM user_memberships WHERE user_id = ?', [id]);
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
    await post('/admin/categories', admin, { name: 'cs错域', scope: 'SCIENCE', parentId: product.id }).expect(409);
    const c = await create();
    await call('patch', `/admin/contents/${c.id}`, admin, { version: c.version, categoryId: product.id }).expect(409);
    await call('delete', `/admin/categories/${category.id}?version=${category.version}`, admin).expect(409);
    const listed = data(await call('get', '/categories?scope=COURSE').expect(200)); expect(listed.items.every((x: any) => x.scope === 'COURSE')).toBe(true);
  });
  it('validates free science, paired price changes, immutable kind and media purpose', async () => {
    const dto = { kind: 'SCIENCE_ARTICLE', title: 'cs非法', summary: '', categoryId: scienceCategory.id, coverMediaId: cover.id, accessPolicy: 'PURCHASE', priceCents: 100 };
    await post('/admin/contents', admin, dto).expect(400);
    await post('/admin/contents', admin, { ...dto, accessPolicy: 'MEMBER_OR_PURCHASE' }).expect(400);
    const c = await create();
    await call('patch', `/admin/contents/${c.id}`, admin, { version: c.version, priceCents: 10 }).expect(400);
    await call('patch', `/admin/contents/${c.id}`, admin, { version: c.version, kind: 'SCIENCE_VIDEO' }).expect(400);
    await call('patch', `/admin/contents/${c.id}`, admin, { version: c.version, coverMediaId: columnCover.id }).expect(409);
  });
  it('offers separate science/course scopes, rejects legacy scope and cross-scope parents', async () => {
    for (const scope of ['SCIENCE', 'COURSE', 'PRODUCT']) {
      const list = data(await call('get', `/categories?scope=${scope}`).expect(200));
      expect(list.items.every((c: any) => c.scope === scope)).toBe(true);
    }
    await call('get', '/categories?scope=CONTENT').expect(400);
    await call('get', '/admin/categories?scope=CONTENT', admin).expect(400);
    await post('/admin/categories', admin, { name: 'cs旧域', scope: 'CONTENT' }).expect(400);
    await post('/admin/categories', admin, { name: 'cs跨域子分类', scope: 'COURSE', parentId: scienceCategory.id }).expect(409);
    await post('/admin/categories', admin, { name: 'cs跨域子分类', scope: 'SCIENCE', parentId: category.id }).expect(409);
    const child = data(await post('/admin/categories', admin, { name: 'cs同域子分类', scope: 'SCIENCE', parentId: scienceCategory.id }).expect(201)); categories.push(child.id);
    await call('patch', `/admin/categories/${child.id}`, admin, { version: child.version, parentId: category.id }).expect(409);
    await call('patch', `/admin/categories/${child.id}`, admin, { version: child.version, scope: 'COURSE' }).expect(400);
    await call('get', '/admin/categories', customer).expect(401);
  });
  it('binds both science kinds and both course kinds exclusively to their own scope', async () => {
    for (const kind of ['SCIENCE_ARTICLE', 'SCIENCE_VIDEO', 'ARTICLE_COURSE', 'VIDEO_COURSE']) {
      const wrong = kind.endsWith('COURSE') ? scienceCategory : category;
      await post('/admin/contents', admin, { kind, title: 'cs错域内容', summary: '', coverMediaId: cover.id, categoryId: wrong.id, accessPolicy: 'FREE', priceCents: 0 }).expect(409).expect(assertCode('CATEGORY_UNAVAILABLE'));
      const c = await create(kind);
      expect(c.category.scope).toBe(kind.endsWith('COURSE') ? 'COURSE' : 'SCIENCE');
      await call('patch', `/admin/contents/${c.id}`, admin, { version: c.version, categoryId: wrong.id }).expect(409);
    }
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
  it('requires the configured OSS host for new covers and preserves public cover URLs', async () => {
    for (const publicUrl of ['https://example.com/cs.png', 'http://chunai-photo.oss-cn-hangzhou.aliyuncs.com/cs.png',
      'https://chunai-photo.oss-cn-hangzhou.aliyuncs.com.evil.invalid/cs.png', 'https://chunai-photo.oss-cn-hangzhou.aliyuncs.com/cs.png?Signature=secret']) {
      await post('/admin/content-media/images', admin, { purpose: 'CONTENT_COVER', publicUrl, mimeType: 'image/png', sizeBytes: 100 }).expect(400);
    }
    expect(cover.provider).toBe('OSS'); expect(cover.publicUrl).toBe('https://chunai-photo.oss-cn-hangzhou.aliyuncs.com/cs.png');
    const { c } = await fixture('SCIENCE_ARTICLE'); expect(data(await call('get', `/articles/${c.id}`).expect(200)).cover.publicUrl).toBe(cover.publicUrl);
    const legacy = await image('CONTENT_COVER');
    await db.query("UPDATE content_media SET public_url = 'https://example.com/legacy.png', provider = 'EXTERNAL_IMAGE' WHERE id = ?", [legacy.id]);
    await post('/admin/contents', admin, { kind: 'SCIENCE_ARTICLE', title: 'cs旧封面', summary: '', coverMediaId: legacy.id, categoryId: scienceCategory.id, accessPolicy: 'FREE', priceCents: 0 }).expect(400);
    await call('patch', `/admin/contents/${c.id}`, admin, { version: c.version, coverMediaId: legacy.id }).expect(400);
  });
  it('stores external sources encrypted and returns Bilibili links only via the playback API', async () => {
    const source = await external('BILIBILI'); let c = await create('SCIENCE_VIDEO');
    c.version = data(await call('put', `/admin/contents/${c.id}/body`, admin, { version: c.version, videoMediaId: source.id }).expect(200)).version;
    c = data(await post(`/admin/contents/${c.id}/publish`, admin, { version: c.version }).expect(200));
    const grant = data(await call('get', `/videos/${c.id}/playback`).expect(200).expect('Cache-Control', 'private, no-store'));
    expect(grant).toMatchObject({ provider: 'BILIBILI', mode: 'EXTERNAL_LINK', playbackUrl: null, accessPassword: null, expiresAt: null });
    expect(grant.externalUrl).toContain('bilibili.com/video/');
    const [stored] = await db.query('SELECT external_url_encrypted FROM content_media WHERE id = ?', [source.id]);
    expect(stored.external_url_encrypted).not.toContain('bilibili');
    for (const path of [`/videos/${c.id}`, '/videos', `/admin/contents/${c.id}`, `/admin/contents/${c.id}/body`]) {
      expect(JSON.stringify((await call('get', path, path.startsWith('/admin') ? admin : undefined).expect(200)).body)).not.toMatch(/bilibili\.com|externalUrlEncrypted|accessPassword/);
    }
    const course = await create('VIDEO_COURSE'); const ch = await chapter(course);
    await call('put', `/admin/chapters/${ch.id}/body`, admin, { version: ch.version, videoMediaId: source.id }).expect(400);
  });
  it('validates external URLs, passwords and administrator permission without exposing secrets', async () => {
    const valid = { provider: 'FEISHU', externalUrl: 'https://cs-test.feishu.cn/file/csTestFileToken', accessPassword: 'csFilePassword', durationSeconds: 60 };
    await post('/admin/content-media/external-videos', customer, valid).expect(401);
    await post('/admin/content-media/external-videos', reader, valid).expect(403);
    for (const dto of [{ ...valid, externalUrl: 'https://feishu.cn.evil.invalid/file/cs' }, { ...valid, accessPassword: undefined },
      { ...valid, externalUrl: 'javascript:alert(1)' }, { ...valid, provider: 'BILIBILI', externalUrl: 'https://b23.tv/csAbcd' }, { ...valid, durationSeconds: -1 }])
      await post('/admin/content-media/external-videos', admin, dto).expect(400);
    const saved = process.env.CONTENT_MEDIA_ENCRYPTION_KEY; delete process.env.CONTENT_MEDIA_ENCRYPTION_KEY;
    try { await post('/admin/content-media/external-videos', admin, valid).expect(503).expect(assertCode('MEDIA_SOURCE_UNAVAILABLE')); }
    finally { process.env.CONTENT_MEDIA_ENCRYPTION_KEY = saved; }
  });
  it('only releases Feishu credentials to active members and never leaks them through metadata or audits', async () => {
    const { c, ch, source } = await memberVideo(); const u = await user();
    const path = `/chapters/${ch.id}/playback`;
    await call('get', path).expect(401); await call('get', path, u).expect(403); await call('get', path, admin).expect(401);
    expect(data(await call('get', `/videos/${c.id}`, u).expect(200)).access.reason).toBe('MEMBERSHIP_REQUIRED');
    for (const metadata of [`/videos/${c.id}`, `/courses/${c.id}/chapters`, '/videos?accessPolicy=MEMBER', `/admin/chapters/${ch.id}/body`]) {
      expect(JSON.stringify((await call('get', metadata, metadata.startsWith('/admin') ? admin : u).expect(200)).body)).not.toMatch(/csFilePassword|feishu\.cn|externalUrlEncrypted|accessPasswordEncrypted/);
    }
    await call('put', `/admin/users/${u.user.id}/membership`, admin, memberTerm()).expect(200);
    const grant = data(await call('get', path, u).expect(200).expect('Cache-Control', 'private, no-store'));
    expect(grant).toMatchObject({ provider: 'FEISHU', mode: 'EXTERNAL_LINK', playbackUrl: null, externalUrl: 'https://cs-test.feishu.cn/file/csTestFileToken', accessPassword: 'csFilePassword', expiresAt: null, preview: false });
    expect(data(await call('get', '/me', u).expect(200)).membership.active).toBe(true);
    await call('get', path, stranger).expect(403);
    expect(data(await call('get', `/admin/chapters/${ch.id}/playback`, admin).expect(200)).accessPassword).toBe('csFilePassword');
    const [row] = await db.query('SELECT external_url_encrypted, access_password_encrypted FROM content_media WHERE id = ?', [source.id]);
    expect(JSON.stringify(row)).not.toMatch(/csFilePassword|feishu\.cn/);
    const audits = await db.query('SELECT details FROM commerce_audit_logs WHERE resource_id IN (?, ?)', [source.id, ch.id]);
    expect(JSON.stringify(audits)).not.toMatch(/csFilePassword|feishu\.cn|externalUrlEncrypted/);
    await post('/order-quotes', u, { type: 'COURSE', courseId: c.id }).expect(409);
  });
  it('prevents Feishu previews, free bindings and policy changes from bypassing membership', async () => {
    const { c, ch, source } = await memberVideo();
    await call('patch', `/admin/chapters/${ch.id}`, admin, { version: ch.version, isPreview: true }).expect(400);
    await call('patch', `/admin/contents/${c.id}`, admin, { version: c.version, accessPolicy: 'FREE', priceCents: 0 }).expect(400);
    await call('patch', `/admin/contents/${c.id}`, admin, { version: c.version, accessPolicy: 'PURCHASE', priceCents: 100 }).expect(400);
    const science = await create('SCIENCE_VIDEO');
    await call('put', `/admin/contents/${science.id}/body`, admin, { version: science.version, videoMediaId: source.id }).expect(400);
    const preview = await chapter(c, true);
    await call('put', `/admin/chapters/${preview.id}/body`, admin, { version: preview.version, videoMediaId: source.id }).expect(400);
    const purchased = await fixture(); await pay(await order(purchased.c));
    await call('patch', `/admin/contents/${purchased.c.id}`, admin, { version: purchased.c.version, accessPolicy: 'MEMBER', priceCents: 0 }).expect(409);
  });
  it('separates membership management from content permissions and rejects stale or invalid terms', async () => {
    const u = await user(); const path = `/admin/users/${u.user.id}/membership`;
    await call('get', '/me/membership').expect(401); await call('get', '/me/membership', admin).expect(401);
    expect(data(await call('get', '/me/membership', u).expect(200))).toEqual({ active: false, expiresAt: null, benefitCodes: [], membership: null });
    await call('get', path, u).expect(401); await call('get', path, editor).expect(403);
    await call('put', path, editor, memberTerm()).expect(403); await post(`${path}/revoke`, editor, { version: 1, reason: 'cs' }).expect(403);
    await call('put', path, admin, memberTerm(1)).expect(409);
    await call('put', path, admin, memberTerm(0, { startsAt: '2026-01-01T00:00:00' })).expect(400);
    await call('put', path, admin, memberTerm(0, { expiresAt: new Date(Date.now() - 120000).toISOString() })).expect(400);
    const result = data(await call('put', path, admin, memberTerm()).expect(200)); expect(result.active).toBe(true);
    await call('put', path, admin, memberTerm()).expect(409);
    expect(data(await call('get', path, admin).expect(200)).membership.version).toBe(1);
    const changed = await Promise.all([call('put', path, admin, memberTerm(1)), call('put', path, admin, memberTerm(1))]);
    expect(changed.map(r => r.status).sort()).toEqual([200, 409]);
    await db.manager.update(AdminAccount, admin.id, { permissions: PERMISSIONS.filter(p => p !== 'membership:write') });
    try { await call('get', path, admin).expect(403); await call('put', path, admin, memberTerm(2)).expect(403); }
    finally { await db.manager.update(AdminAccount, admin.id, { permissions: [...PERMISSIONS] }); }
  });
  it('applies membership starts, expiry, renewal and revocation immediately to Feishu and local streams', async () => {
    const { ch } = await memberVideo(); const u = await user(); const path = `/admin/users/${u.user.id}/membership`, playback = `/chapters/${ch.id}/playback`;
    await call('put', path, admin, memberTerm(0, { startsAt: new Date(Date.now() + 60000).toISOString() })).expect(200);
    await call('get', playback, u).expect(403);
    await call('put', path, admin, memberTerm(1)).expect(200); await call('get', playback, u).expect(200);
    const local = await create('VIDEO_COURSE', { accessPolicy: 'MEMBER', priceCents: 0 }); const localChapter = await chapter(local);
    await post(`/admin/contents/${local.id}/publish`, admin, { version: local.version }).expect(200);
    const localGrant = data(await call('get', `/chapters/${localChapter.id}/playback`, u).expect(200)); await play(localGrant.playbackUrl, 'bytes=0-15').expect(206);
    await db.query('UPDATE user_memberships SET starts_at = ?, expires_at = ? WHERE user_id = ?', [new Date(Date.now() - 120000), new Date(Date.now() - 1000), u.user.id]);
    await call('get', playback, u).expect(403); await play(localGrant.playbackUrl).expect(403);
    expect(data(await call('get', '/me/membership', u).expect(200)).active).toBe(false);
    await call('put', path, admin, memberTerm(2)).expect(200); await call('get', playback, u).expect(200);
    const revoked = data(await post(`${path}/revoke`, admin, { version: 3, reason: 'cs撤销' }).expect(200)); expect(revoked.active).toBe(false);
    await call('get', playback, u).expect(403); await play(localGrant.playbackUrl).expect(403);
    await post(`${path}/revoke`, admin, { version: 3, reason: 'cs旧版本' }).expect(409);
    await call('put', path, admin, memberTerm(4)).expect(200);
    await post('/auth/logout', u, {}).expect(200); await call('get', playback, u).expect(401);
  });
  it('migrates shared legacy hierarchies atomically, moves courses and is safe to retry', async () => {
    expect(process.env.DB_NAME).toMatch(/_test$/);
    const root = data(await post('/admin/categories', admin, { name: 'cs迁移父分类', scope: 'SCIENCE' }).expect(201)); categories.push(root.id);
    const child = data(await post('/admin/categories', admin, { name: 'cs迁移子分类', scope: 'SCIENCE', parentId: root.id, enabled: false }).expect(201)); categories.push(child.id);
    const article = await create('SCIENCE_ARTICLE'), course = await create('ARTICLE_COURSE');
    const ordersBefore = await db.query('SELECT * FROM commerce_orders ORDER BY id');
    const rightsBefore = await db.query('SELECT * FROM course_entitlements ORDER BY id');
    const q = db.createQueryRunner(); await q.connect();
    try {
      await q.query('ALTER TABLE product_categories DROP CHECK chk_category_scope');
      await q.query("UPDATE product_categories SET scope='CONTENT' WHERE id IN (?,?)", [root.id, child.id]);
      await q.query('UPDATE contents SET category_id=? WHERE id IN (?,?)', [child.id, article.id, course.id]);
      const migration = new SplitContentCategories1793404800000(); await migration.up(q);
      const newRoot = legacyCourseCategoryId(root.id), newChild = legacyCourseCategoryId(child.id); categories.push(newRoot, newChild);
      const rows = await q.query('SELECT id,scope,parent_id,enabled,version FROM product_categories WHERE id IN (?,?,?,?) ORDER BY id', [root.id, child.id, newRoot, newChild]);
      expect(rows.find((r: any) => r.id === root.id)).toMatchObject({ scope: 'SCIENCE', parent_id: null, version: 2 });
      expect(rows.find((r: any) => r.id === child.id)).toMatchObject({ scope: 'SCIENCE', parent_id: root.id, enabled: 0 });
      expect(rows.find((r: any) => r.id === newRoot)).toMatchObject({ scope: 'COURSE', parent_id: null });
      expect(rows.find((r: any) => r.id === newChild)).toMatchObject({ scope: 'COURSE', parent_id: newRoot, enabled: 0 });
      expect((await db.getRepository(Content).findOneByOrFail({ id: article.id })).categoryId).toBe(child.id);
      expect(await db.getRepository(Content).findOneByOrFail({ id: course.id })).toMatchObject({ categoryId: newChild, version: course.version + 1 });
      await migration.up(q);
      expect((await q.query('SELECT id,scope,parent_id,enabled,version FROM product_categories WHERE id IN (?,?,?,?) ORDER BY id', [root.id, child.id, newRoot, newChild]))).toEqual(rows);
      expect(await db.query('SELECT * FROM commerce_orders ORDER BY id')).toEqual(ordersBefore);
      expect(await db.query('SELECT * FROM course_entitlements ORDER BY id')).toEqual(rightsBefore);
      await expect(q.query("UPDATE product_categories SET scope='CONTENT' WHERE id=?", [root.id])).rejects.toBeDefined();
    } finally { await q.release(); }
  });
  it('checks content visibility even for members and does not let membership unlock purchased-only courses', async () => {
    const { c, ch } = await memberVideo(); const u = await user(); await call('put', `/admin/users/${u.user.id}/membership`, admin, memberTerm()).expect(200);
    const purchaseOnly = await fixture('VIDEO_COURSE'); await call('get', `/chapters/${purchaseOnly.paid.id}/playback`, u).expect(403);
    const article = await create('ARTICLE_COURSE', { accessPolicy: 'MEMBER', priceCents: 0 }); const text = await chapter(article);
    await post(`/admin/contents/${article.id}/publish`, admin, { version: article.version }).expect(200);
    await call('get', `/chapters/${text.id}/body`).expect(401); await call('get', `/chapters/${text.id}/body`, stranger).expect(403);
    await call('get', `/chapters/${text.id}/body`, u).expect(200);
    await post(`/admin/contents/${c.id}/unpublish`, admin, { version: c.version }).expect(200); await call('get', `/chapters/${ch.id}/playback`, u).expect(404);
  });
});
