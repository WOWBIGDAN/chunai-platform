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
import { AdminAccount, CartItem, Category, Product, Sku } from '../../src/commerce/entities';
import { Content, ContentFavorite } from '../../src/content/entities';
import { PERMISSIONS } from '../../src/commerce/permissions';
import { CartFavorites1793232000000 } from '../../src/database/migrations/1793232000000-CartFavorites';

if (!process.env.TEST_DB_NAME?.endsWith('_test') || !process.env.TEST_DB_PASSWORD) throw new Error('Requires isolated _test database');
Object.assign(process.env, { NODE_ENV: 'test', DB_HOST: process.env.TEST_DB_HOST ?? '127.0.0.1', DB_PORT: process.env.TEST_DB_PORT ?? '3306',
  DB_USER: process.env.TEST_DB_USER ?? 'chunai_test', DB_PASSWORD: process.env.TEST_DB_PASSWORD, DB_NAME: process.env.TEST_DB_NAME,
  JWT_SECRET: randomBytes(48).toString('hex'), TERMS_VERSION: '2026-10-01', PRIVACY_VERSION: '2026-10-01', COMMERCE_TEST_PAYMENTS: 'true',
  CONTENT_IMAGE_OSS_HOST: 'chunai-photo.oss-cn-hangzhou.aliyuncs.com', CONTENT_MEDIA_ENCRYPTION_KEY: randomBytes(32).toString('base64') });

describe('cart checkout and content favorites with real MySQL', () => {
  let app: INestApplication, db: DataSource, admin: any, customer: any, stranger: any, category: any, contentCategory: any, image: any, cover: any, video: any, address: any;
  const products: string[] = [], contents: string[] = [], users: string[] = [];
  const responses: { method: string; path: string; status: number; data: unknown }[] = [];
  const password = 'csCartFavorites#123'; let phone = 16000000000 + Math.floor(Math.random() * 100000000);
  const data = (r: request.Response) => r.body.data;
  const call = (method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, who?: any, body?: any, key?: string) => {
    let r = request(app.getHttpServer())[method](`/api/v1${path}`);
    if (who) r = r.auth(who.accessToken, { type: 'bearer' });
    if (key) r = r.set('Idempotency-Key', key);
    r.on('response', (res: request.Response) => {
      if (res.status >= 200 && res.status < 300 && !path.includes('/auth/')) responses.push({ method, path: path.split('?')[0], status: res.status, data: res.body.data });
    });
    return body === undefined ? r : r.send(body);
  };
  const post = (path: string, who: any, body: any, key = randomUUID()) => call('post', path, who, body, key);
  const code = (expected: string) => (r: request.Response) => expect(r.body.code).toBe(expected);
  const cartPut = (skuId: string, quantity = 1, version = 0, selected = true, who = customer) => call('put', `/me/cart/items/${skuId}`, who, { quantity, version, selected });
  const favorite = (id: string, who = customer) => call('put', `/me/favorites/${id}`, who);
  const favoriteState = async (id: string) => data(await call('get', `/me/favorites/${id}`, customer).expect(200));
  const cartLine = async (skuId: string) => data(await call('get', '/me/cart?pageSize=100', customer).expect(200)).items.find((i: any) => i.skuId === skuId);
  async function user() {
    const u = data(await post('/auth/register', null, { phone: `+86${++phone}`, password, nickname: 'cs购物车用户', termsVersion: '2026-10-01', privacyVersion: '2026-10-01' }).expect(201));
    users.push(u.user.id); return u;
  }
  async function product(stock = 10) {
    const p = data(await post('/admin/products', admin, { name: `cs商品${randomUUID()}`, summary: 'cs商品', categoryId: category.id, coverMediaId: image.id, detailHtml: '<p>cs</p>', afterSalePolicy: 'cs售后' }).expect(201));
    products.push(p.id);
    const s = data(await post(`/admin/products/${p.id}/skus`, admin, { skuCode: randomUUID(), attributes: [{ name: 'cs规格', value: '标准' }], priceCents: 1200 }).expect(201));
    await post(`/admin/skus/${s.id}/stock-adjustments`, admin, { version: s.version, delta: stock, reason: 'cs入库' }).expect(201);
    const current = data(await call('get', `/admin/products/${p.id}`, admin).expect(200));
    await post(`/admin/products/${p.id}/publish`, admin, { version: current.version }).expect(200);
    return { p, s };
  }
  async function unpublishProduct(id: string) {
    const current = data(await call('get', `/admin/products/${id}`, admin).expect(200));
    return data(await post(`/admin/products/${id}/unpublish`, admin, { version: current.version }).expect(200));
  }
  async function cartQuote(lines: any[], who = customer, addressId = address.id) {
    return data(await post('/me/cart/quote', who, { addressId, items: lines.map(i => ({ skuId: i.skuId, version: i.version })) }).expect(201));
  }
  async function content(kind = 'SCIENCE_ARTICLE', accessPolicy = 'FREE', publish = true) {
    let c = data(await post('/admin/contents', admin, { kind, title: `cs收藏${randomUUID()}`, summary: 'cs摘要', categoryId: contentCategory.id, coverMediaId: cover.id, accessPolicy, priceCents: accessPolicy === 'PURCHASE' ? 1500 : 0 }).expect(201));
    contents.push(c.id);
    let ch: any;
    if (kind.endsWith('COURSE')) {
      ch = data(await post(`/admin/courses/${c.id}/chapters`, admin, { title: 'cs付费章', sortOrder: 1, isPreview: false }).expect(201));
      ch.version = data(await call('put', `/admin/chapters/${ch.id}/body`, admin, { version: ch.version, bodyHtml: '<p>cs受保护正文</p>', imageMediaIds: [] }).expect(200)).version;
      await post(`/admin/chapters/${ch.id}/publish`, admin, { version: ch.version }).expect(200);
    } else c = data(await call('put', `/admin/contents/${c.id}/body`, admin, { version: c.version, ...(kind === 'SCIENCE_VIDEO' ? { videoMediaId: video.id } : { bodyHtml: '<p>cs正文</p>', imageMediaIds: [] }) }).expect(200));
    // Body responses contain version but not always the content metadata.
    const id = contents[contents.length - 1];
    const current = data(await call('get', `/admin/contents/${id}`, admin).expect(200));
    if (publish) c = data(await post(`/admin/contents/${id}/publish`, admin, { version: current.version }).expect(200));
    return { ...current, ...c, id, chapterId: ch?.id };
  }
  beforeAll(async () => {
    const { AppModule } = await import('../../src/app.module');
    const mod = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(ThrottlerGuard).useValue({ canActivate: () => true }).compile();
    app = mod.createNestApplication({ bodyParser: false }); setupApp(app); db = app.get(DataSource); await db.runMigrations(); await app.init();
    const id = randomUUID(), username = `cs_${id}`;
    await db.getRepository(AdminAccount).save({ id, username, displayName: 'cs购物车管理员', passwordHash: await new PasswordService().hash(password), permissions: [...PERMISSIONS], enabled: true, version: 1 });
    admin = { ...data(await post('/admin/auth/login', null, { username, password }).expect(200)), id };
    customer = await user(); stranger = await user();
    category = data(await post('/admin/categories', admin, { name: 'cs购物分类', scope: 'PRODUCT' }).expect(201));
    contentCategory = data(await post('/admin/categories', admin, { name: 'cs收藏分类', scope: 'CONTENT' }).expect(201));
    image = data(await post('/admin/product-images', admin, { publicUrl: 'https://example.com/cs.png', mimeType: 'image/png', sizeBytes: 1024 }).expect(201));
    cover = data(await post('/admin/content-media/images', admin, { purpose: 'CONTENT_COVER', publicUrl: 'https://chunai-photo.oss-cn-hangzhou.aliyuncs.com/cs.png', mimeType: 'image/png', sizeBytes: 1024 }).expect(201));
    video = data(await post('/admin/content-media/external-videos', admin, { provider: 'BILIBILI', externalUrl: 'https://www.bilibili.com/video/BV1xx411c7mD/', durationSeconds: 3 }).expect(201));
    address = data(await post('/me/addresses', customer, { recipient: 'cs收件人', phone: '+8613800000000', provinceCode: '310000', province: '上海市', cityCode: '310100', city: '上海市', districtCode: '310101', district: '黄浦区', detail: 'cs测试地址' }).expect(201));
  }, 120000);
  afterAll(async () => {
    mkdirSync('.tmp', { recursive: true }); writeFileSync('.tmp/cart-favorites-contract-responses.json', JSON.stringify(responses));
    if (db?.isInitialized) {
      for (const id of users) {
        const orders = 'SELECT id FROM commerce_orders WHERE user_id = ?';
        for (const sql of ['DELETE FROM course_entitlements WHERE user_id = ?', 'DELETE FROM user_memberships WHERE user_id = ?',
          `DELETE FROM payment_records WHERE order_id IN (${orders})`, `DELETE FROM stock_movements WHERE order_id IN (${orders})`,
          `DELETE FROM order_items WHERE order_id IN (${orders})`, 'DELETE FROM commerce_orders WHERE user_id = ?', 'DELETE FROM order_quotes WHERE user_id = ?',
          'DELETE FROM user_addresses WHERE user_id = ?', 'DELETE FROM users WHERE id = ?']) await db.query(sql, [id]);
      }
      for (const id of products) {
        await db.query('DELETE FROM stock_movements WHERE sku_id IN (SELECT id FROM product_skus WHERE product_id = ?)', [id]);
        await db.query('DELETE FROM product_skus WHERE product_id = ?', [id]); await db.query('DELETE FROM products WHERE id = ?', [id]);
      }
      for (const id of contents) { await db.query('DELETE FROM course_chapters WHERE course_id = ?', [id]); await db.query('DELETE FROM contents WHERE id = ?', [id]); }
      for (const id of [category?.id, contentCategory?.id].filter(Boolean)) await db.query('DELETE FROM product_categories WHERE id = ?', [id]);
      if (admin?.id) {
        await db.query('DELETE FROM product_images WHERE operator_id = ?', [admin.id]); await db.query('DELETE FROM content_media WHERE operator_id = ?', [admin.id]);
        await db.query('DELETE FROM admin_accounts WHERE id = ?', [admin.id]);
      }
      for (const actor of [...users.map(id => `user:${id}`), `admin:${admin?.id}`]) {
        await db.query('DELETE FROM idempotency_records WHERE actor_key = ?', [actor]); await db.query('DELETE FROM commerce_audit_logs WHERE actor_key = ?', [actor]);
      }
    }
    if (app) await app.close();
  });

  it('requires user sessions, isolates accounts and rejects injected owner, prices and invalid quantities', async () => {
    const { s } = await product();
    for (const path of ['/me/cart', '/me/favorites']) { await call('get', path).expect(401); await call('get', path, admin).expect(401); }
    for (const quantity of [0, -1, 1000, 1.5, '2', null]) await call('put', `/me/cart/items/${s.id}`, customer, { quantity, version: 0 }).expect(400);
    await call('put', `/me/cart/items/${s.id}`, customer, { quantity: 1, version: 0, userId: stranger.user.id, priceCents: 1 }).expect(400);
    const item = data(await cartPut(s.id, 2).expect(200));
    expect(data(await call('get', '/me/cart', stranger).expect(200)).items).toEqual([]);
    await call('delete', `/me/cart/items/${s.id}?version=${item.version}`, stranger).expect(200);
    expect((await cartLine(s.id)).quantity).toBe(2);
    await post('/me/cart/quote', stranger, { addressId: address.id, items: [{ skuId: s.id, version: item.version }] }).expect(404);
    await post('/me/cart/quote', customer, { addressId: address.id, items: [{ skuId: s.id, version: item.version }, { skuId: s.id, version: item.version }] }).expect(400);
    for (const items of [[null], [1], [{}], []]) await post('/me/cart/quote', customer, { addressId: address.id, items }).expect(400);
    await call('get', '/me/cart?userId=' + stranger.user.id, customer).expect(400);
  });
  it('stores absolute quantities once, prevents lost updates and does not reserve stock', async () => {
    const { s } = await product(5);
    const results = await Promise.all([cartPut(s.id, 2), cartPut(s.id, 2)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    const item = await cartLine(s.id);
    const same = data(await cartPut(s.id, 2, item.version).expect(200)); expect(same.version).toBe(item.version);
    const updated = data(await cartPut(s.id, 3, item.version).expect(200)); expect(updated.quantity).toBe(3);
    await cartPut(s.id, 4, item.version).expect(409).expect(code('VERSION_CONFLICT'));
    await call('delete', `/me/cart/items/${s.id}?version=${item.version}`, customer).expect(409);
    expect((await db.getRepository(Sku).findOneByOrFail({ id: s.id })).reservedStock).toBe(0);
    await cartPut(s.id, 6, updated.version).expect(409).expect(code('STOCK_INSUFFICIENT'));
    await call('delete', `/me/cart/items/${s.id}?version=${updated.version}`, customer).expect(200);
    await call('delete', `/me/cart/items/${s.id}?version=${updated.version}`, customer).expect(200);
  });
  it('keeps unavailable items removable and recalculates offline, disabled SKU, category and stock states', async () => {
    const { p, s } = await product(5); let item = data(await cartPut(s.id, 5).expect(200));
    const currentSku = await db.getRepository(Sku).findOneByOrFail({ id: s.id });
    await post(`/admin/skus/${s.id}/stock-adjustments`, admin, { version: currentSku.version, delta: -3, reason: 'cs库存减少' }).expect(201);
    expect(await cartLine(s.id)).toMatchObject({ quantity: 5, maxQuantity: 2, canPurchase: false, availability: 'STOCK_INSUFFICIENT' });
    item = data(await cartPut(s.id, 2, item.version).expect(200)); expect(item.canPurchase).toBe(true);
    await unpublishProduct(p.id);
    expect(await cartLine(s.id)).toMatchObject({ availability: 'PRODUCT_UNAVAILABLE', product: null, canPurchase: false });
    await cartPut(s.id, 3, item.version).expect(409);
    item = data(await cartPut(s.id, 1, item.version, false).expect(200));
    await post('/me/cart/quote', customer, { addressId: address.id, items: [{ skuId: s.id, version: item.version }] }).expect(409).expect(code('CART_ITEM_NOT_SELECTED'));
    const current = data(await call('get', `/admin/products/${p.id}`, admin).expect(200));
    await post(`/admin/products/${p.id}/publish`, admin, { version: current.version }).expect(200);
    expect((await cartLine(s.id)).canPurchase).toBe(true);
    await db.getRepository(Sku).update(s.id, { enabled: false }); expect((await cartLine(s.id)).availability).toBe('SKU_DISABLED');
    await db.getRepository(Sku).update(s.id, { enabled: true, onHandStock: 0 }); expect((await cartLine(s.id)).availability).toBe('OUT_OF_STOCK');
    await db.getRepository(Category).update(category.id, { enabled: false }); expect((await cartLine(s.id)).availability).toBe('CATEGORY_UNAVAILABLE');
    await db.getRepository(Category).update(category.id, { enabled: true });
    await call('delete', `/me/cart/items/${s.id}?version=${item.version}`, customer).expect(200);
    await cartPut(s.id).expect(409).expect(code('OUT_OF_STOCK'));
  });
  it('quotes latest prices, checks stock again, and only consumes matching cart lines when order commits', async () => {
    const { s } = await product(5), other = await product();
    const item = data(await cartPut(s.id, 2).expect(200)); const retained = data(await cartPut(other.s.id, 1, 0, false).expect(200));
    const q = await cartQuote([item]); expect(q.payableAmountCents).toBe(2400);
    expect((await db.getRepository(Sku).findOneByOrFail({ id: s.id })).reservedStock).toBe(0);
    const key = randomUUID(); const o = data(await post('/orders', customer, { quoteId: q.quoteId }, key).expect(201));
    expect(await cartLine(s.id)).toBeUndefined(); expect((await cartLine(retained.skuId)).selected).toBe(false);
    expect((await db.getRepository(Sku).findOneByOrFail({ id: s.id })).reservedStock).toBe(2);
    const readded = data(await cartPut(s.id).expect(200));
    expect(data(await post('/orders', customer, { quoteId: q.quoteId }, key).expect(201)).id).toBe(o.id);
    expect(data(await post('/orders', customer, { quoteId: q.quoteId }).expect(201)).id).toBe(o.id);
    expect((await cartLine(s.id)).id).toBe(readded.id);
    await post(`/orders/${o.id}/cancel`, customer, { version: o.version, reason: 'cs取消' }).expect(200);
    expect((await db.getRepository(Sku).findOneByOrFail({ id: s.id })).reservedStock).toBe(0);
  });
  it('preserves edits after quoting and does not clear cart on failed checkout or direct orders', async () => {
    const { p, s } = await product(10); let item = data(await cartPut(s.id, 2).expect(200));
    let q = await cartQuote([item]); item = data(await cartPut(s.id, 3, item.version).expect(200));
    await post('/orders', customer, { quoteId: q.quoteId }).expect(201); expect((await cartLine(s.id)).quantity).toBe(3);
    q = await cartQuote([item]);
    const sku = await db.getRepository(Sku).findOneByOrFail({ id: s.id });
    await call('patch', `/admin/skus/${s.id}`, admin, { version: sku.version, priceCents: 1400 }).expect(200);
    await post('/orders', customer, { quoteId: q.quoteId }).expect(409).expect(code('QUOTE_CHANGED'));
    expect((await cartLine(s.id)).quantity).toBe(3);
    q = await cartQuote([item]); expect(q.items[0].unitPriceCents).toBe(1400);
    await unpublishProduct(p.id); await post('/orders', customer, { quoteId: q.quoteId }).expect(409).expect(code('PRODUCT_UNAVAILABLE'));
    expect((await cartLine(s.id)).quantity).toBe(3);
    const other = await product(); const direct = data(await cartPut(other.s.id).expect(200));
    const dq = data(await post('/order-quotes', customer, { type: 'PRODUCT', addressId: address.id, items: [{ skuId: other.s.id, quantity: 1 }] }).expect(201));
    await post('/orders', customer, { quoteId: dq.quoteId }).expect(201); expect((await cartLine(other.s.id)).id).toBe(direct.id);
  });
  it('prevents competing checkouts from overselling and leaves the losing cart intact', async () => {
    const { s } = await product(2); const mine = data(await cartPut(s.id, 2).expect(200));
    const theirs = data(await cartPut(s.id, 2, 0, true, stranger).expect(200));
    const a = data(await post('/me/addresses', stranger, { recipient: 'cs', phone: '+8613800000000', provinceCode: '310000', province: '上海', cityCode: '310100', city: '上海', districtCode: '310101', district: '黄浦', detail: 'cs地址' }).expect(201));
    const q1 = await cartQuote([mine]), q2 = await cartQuote([theirs], stranger, a.id);
    const results = await Promise.all([post('/orders', customer, { quoteId: q1.quoteId }), post('/orders', stranger, { quoteId: q2.quoteId })]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    expect(results.find(r => r.status === 409)?.body.code).toBe('STOCK_INSUFFICIENT');
    expect(await db.getRepository(CartItem).countBy({ skuId: s.id })).toBe(1);
    expect((await db.getRepository(Sku).findOneByOrFail({ id: s.id })).reservedStock).toBe(2);
    const loser = results[0].status === 409 ? customer : stranger;
    expect(data(await call('get', '/me/cart', loser).expect(200)).items.find((i: any) => i.skuId === s.id)).toMatchObject({ canPurchase: false, availability: 'OUT_OF_STOCK' });
  });
  it('favorites articles and videos idempotently, scopes state to owner and rejects unrecognized bodies', async () => {
    const article = await content(), v = await content('SCIENCE_VIDEO');
    const saved = await Promise.all([favorite(article.id).expect(200), favorite(article.id).expect(200)]);
    expect(data(saved[0]).id).toBe(data(saved[1]).id); expect(await db.getRepository(ContentFavorite).countBy({ contentId: article.id })).toBe(1);
    await favorite(v.id).expect(200);
    expect((await favoriteState(article.id)).favorited).toBe(true);
    expect(data(await call('get', `/me/favorites/${article.id}`, stranger).expect(200)).favorited).toBe(false);
    await call('delete', `/me/favorites/${article.id}`, stranger).expect(200); expect((await favoriteState(article.id)).favorited).toBe(true);
    expect(data(await call('get', '/me/favorites?kind=SCIENCE_VIDEO&status=VALID', customer).expect(200)).items.map((i: any) => i.contentId)).toContain(v.id);
    await call('put', `/me/favorites/${article.id}`, customer, { userId: stranger.user.id }).expect(400);
    await favorite(article.id, admin).expect(401); await favorite(randomUUID()).expect(404);
    await call('get', '/me/favorites?status=OFFLINE', customer).expect(400);
    await call('delete', `/me/favorites/${article.id}`, customer).expect(200); await call('delete', `/me/favorites/${article.id}`, customer).expect(200);
    expect((await favoriteState(article.id)).favorite).toBeNull();
  });
  it('retains offline favorites as invalid without metadata and restores them after republication', async () => {
    const c = await content(); await favorite(c.id).expect(200);
    const offline = data(await post(`/admin/contents/${c.id}/unpublish`, admin, { version: c.version }).expect(200));
    expect((await favoriteState(c.id)).favorite).toMatchObject({ valid: false, invalidReason: 'CONTENT_UNAVAILABLE', content: null, access: { canAccess: false } });
    await favorite(c.id, stranger).expect(404); expect(data(await favorite(c.id).expect(200)).valid).toBe(false);
    const invalid = data(await call('get', '/me/favorites?status=INVALID', customer).expect(200)); expect(invalid.items.map((i: any) => i.contentId)).toContain(c.id);
    await call('get', `/articles/${c.id}/body`, customer).expect(404);
    await post(`/admin/contents/${c.id}/publish`, admin, { version: offline.version }).expect(200);
    expect((await favoriteState(c.id)).favorite.valid).toBe(true);
    await db.getRepository(Category).update(contentCategory.id, { enabled: false });
    expect((await favoriteState(c.id)).favorite).toMatchObject({ invalidReason: 'CATEGORY_UNAVAILABLE', content: null });
    await favorite(c.id, stranger).expect(404);
    await db.getRepository(Category).update(contentCategory.id, { enabled: true });
    const draft = await content('SCIENCE_ARTICLE', 'FREE', false); await favorite(draft.id).expect(404);
  });
  it('does not grant purchase rights; offline favorites do not revoke already purchased course rights', async () => {
    const c = await content('ARTICLE_COURSE', 'PURCHASE');
    const f = data(await favorite(c.id).expect(200)); expect(f).toMatchObject({ valid: true, access: { canAccess: false, reason: 'PURCHASE_REQUIRED' } });
    expect(JSON.stringify(f)).not.toMatch(/bodyHtml|externalUrl|accessPassword|storageKey/);
    await call('get', `/chapters/${c.chapterId}/body`, customer).expect(403);
    const q = data(await post('/order-quotes', customer, { type: 'COURSE', courseId: c.id }).expect(201));
    const o = data(await post('/orders', customer, { quoteId: q.quoteId }).expect(201));
    await post(`/admin/orders/${o.id}/test-payment`, admin, { version: o.version, transactionNo: randomUUID() }).expect(200);
    expect((await favoriteState(c.id)).favorite.access).toEqual({ canAccess: true, reason: 'PURCHASED' });
    await post(`/admin/contents/${c.id}/unpublish`, admin, { version: c.version }).expect(200);
    expect((await favoriteState(c.id)).favorite.valid).toBe(false);
    await call('get', `/chapters/${c.chapterId}/body`, customer).expect(200);
  });
  it('rechecks member access after grant and revocation while retaining the favorite', async () => {
    const c = await content('ARTICLE_COURSE', 'MEMBER'); await favorite(c.id).expect(200);
    expect((await favoriteState(c.id)).favorite.access.reason).toBe('MEMBERSHIP_REQUIRED');
    const term = data(await call('put', `/admin/users/${customer.user.id}/membership`, admin, { version: 0, startsAt: new Date(Date.now() - 60000).toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(), reason: 'cs测试' }).expect(200));
    expect((await favoriteState(c.id)).favorite.access.canAccess).toBe(true);
    await post(`/admin/users/${customer.user.id}/membership/revoke`, admin, { version: term.membership.version, reason: 'cs撤销' }).expect(200);
    expect((await favoriteState(c.id)).favorite).toMatchObject({ valid: true, access: { canAccess: false, reason: 'MEMBERSHIP_REQUIRED' } });
  });
  it('migration retry preserves data and database constraints enforce uniqueness and quantity limits', async () => {
    const { s } = await product(); const item = data(await cartPut(s.id).expect(200));
    const runner = db.createQueryRunner(); await runner.connect();
    try { await new CartFavorites1793232000000().up(runner); await new CartFavorites1793232000000().up(runner); } finally { await runner.release(); }
    expect((await cartLine(s.id)).id).toBe(item.id);
    await expect(db.getRepository(CartItem).insert({ id: randomUUID(), userId: customer.user.id, skuId: s.id, quantity: 1, selected: true })).rejects.toMatchObject({ driverError: { code: 'ER_DUP_ENTRY' } });
    await expect(db.query('UPDATE cart_items SET quantity = 0 WHERE id = ?', [item.id])).rejects.toBeDefined();
  });
  it('revokes cart and favorite access immediately after logout', async () => {
    const u = await user();
    await post('/auth/logout', u, {}).expect(200);
    await call('get', '/me/cart', u).expect(401);
    await call('get', '/me/favorites', u).expect(401);
    await cartPut(randomUUID(), 1, 0, true, u).expect(401);
    await favorite(randomUUID(), u).expect(401);
  });
});
