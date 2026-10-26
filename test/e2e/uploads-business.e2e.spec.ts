import 'reflect-metadata';
import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { PasswordService } from '../../src/auth/password.service';
import { AdminAccount } from '../../src/commerce/entities';
import { PERMISSIONS } from '../../src/commerce/permissions';
import { User } from '../../src/database/entities';
import { UploadMedia } from '../../src/uploads/entities';
import { OssStorage } from '../../src/uploads/oss-storage';
import { setupApp } from '../../src/setup-app';
import { MemoryOssStorage, tinyPng } from '../helpers/uploads';

if (!process.env.TEST_DB_NAME || !/^[A-Za-z0-9_]+_test$/.test(process.env.TEST_DB_NAME) || !process.env.TEST_DB_PASSWORD)
  throw new Error('Upload business E2E requires an isolated _test database');
Object.assign(process.env, { NODE_ENV: 'test', DB_HOST: process.env.TEST_DB_HOST ?? '127.0.0.1', DB_PORT: process.env.TEST_DB_PORT ?? '3306',
  DB_USER: process.env.TEST_DB_USER ?? 'chunai_test', DB_PASSWORD: process.env.TEST_DB_PASSWORD, DB_NAME: process.env.TEST_DB_NAME,
  JWT_SECRET: randomBytes(48).toString('hex'), TERMS_VERSION: '2026-10-01', PRIVACY_VERSION: '2026-10-01', COMMERCE_TEST_PAYMENTS: 'true',
  CONTENT_MEDIA_ENCRYPTION_KEY: randomBytes(32).toString('base64'), CONTENT_IMAGE_OSS_HOST: 'chunai-photo.oss-cn-hangzhou.aliyuncs.com',
  PUBLIC_API_URL: 'http://localhost:3000/api/v1' });

describe('unified upload business bindings and private access with real MySQL', () => {
  let app: INestApplication, db: DataSource, admin: any, editor: any, reviewer: any, reader: any, productCategory: any, contentCategory: any, cover: any;
  const storage = new MemoryOssStorage(), password = 'csUploadBusiness#123';
  const users: string[] = [], admins: string[] = [], uploads: string[] = [], products: string[] = [], contents: string[] = [], columns: string[] = [], categories: string[] = [];
  const responses: { method: string; path: string; status: number; data: unknown }[] = [];
  let phone = 17600000000 + Math.floor(Math.random() * 100000000);
  const data = (r: request.Response) => r.body.data;
  const code = (value: string) => (r: request.Response) => expect(r.body.code).toBe(value);
  function call(method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, who?: any, body?: any, key?: string) {
    let req = request(app.getHttpServer())[method](`/api/v1${path}`);
    if (who) req = req.auth(who.accessToken, { type: 'bearer' });
    if (key) req = req.set('Idempotency-Key', key);
    req.on('response', (r: request.Response) => {
      if (r.status >= 200 && r.status < 300 && r.body?.data && !path.includes('/auth/')) responses.push({ method, path: path.split('?')[0], status: r.status, data: r.body.data });
    });
    return body === undefined ? req : req.send(body);
  }
  const post = (path: string, who: any, body: any, key = randomUUID()) => call('post', path, who, body, key);
  async function account(permissions: readonly string[]) {
    const id = randomUUID(), username = `cs_${id}`;
    await db.getRepository(AdminAccount).save({ id, username, displayName: 'cs上传业务测试', passwordHash: await new PasswordService().hash(password), permissions: [...permissions], enabled: true, version: 1 });
    admins.push(id); return { ...data(await post('/admin/auth/login', null, { username, password }).expect(200)), id };
  }
  async function user() {
    const result = data(await post('/auth/register', null, { phone: `+86${++phone}`, password, nickname: 'cs上传测试', termsVersion: '2026-10-01', privacyVersion: '2026-10-01' }).expect(201));
    users.push(result.user.id); return result;
  }
  async function upload(who: any, purpose: string, complete = true) {
    const video = purpose === 'CONTENT_VIDEO', bytes = video ? readFileSync('database/seeds/cs-sample.mp4') : tinyPng;
    const mimeType = video ? 'video/mp4' : 'image/png';
    const ticket = data(await post('/uploads', who, { purpose, fileName: video ? 'cs-video.mp4' : 'cs-image.png', mimeType, sizeBytes: bytes.length,
      ...(video ? { durationSeconds: 3 } : {}) }).expect(201));
    uploads.push(ticket.mediaId); storage.put(ticket.fields.key, bytes, mimeType);
    return complete ? data(await post(`/uploads/${ticket.uploadId}/complete`, who, {}).expect(200)) : { id: ticket.mediaId };
  }
  function productBody(imageId: string) { return { name: 'cs文件绑定商品', summary: 'cs上传业务测试', categoryId: productCategory.id,
    coverMediaId: imageId, galleryMediaIds: [imageId], detailHtml: '<p>cs商品详情</p>', afterSalePolicy: 'cs七天售后' }; }
  async function product(imageId: string) { const result = data(await post('/admin/products', admin, productBody(imageId)).expect(201)); products.push(result.id); return result; }
  async function paidOrder(who: any) {
    const image = await upload(admin, 'PRODUCT_IMAGE'); const p = await product(image.id);
    const sku = data(await post(`/admin/products/${p.id}/skus`, admin, { skuCode: randomUUID(), attributes: [], priceCents: 1000 }).expect(201));
    await post(`/admin/skus/${sku.id}/stock-adjustments`, admin, { version: sku.version, delta: 3, reason: 'cs入库' }).expect(201);
    const current = data(await call('get', `/admin/products/${p.id}`, admin).expect(200));
    await post(`/admin/products/${p.id}/publish`, admin, { version: current.version }).expect(200);
    const address = data(await post('/me/addresses', who, { recipient: 'cs收件人', phone: '+8613800000000', provinceCode: '310000', province: '上海市', cityCode: '310100', city: '上海市', districtCode: '310101', district: '黄浦区', detail: 'cs测试地址100号' }).expect(201));
    const quote = data(await post('/order-quotes', who, { type: 'PRODUCT', addressId: address.id, items: [{ skuId: sku.id, quantity: 1 }] }).expect(201));
    const order = data(await post('/orders', who, { quoteId: quote.quoteId }).expect(201));
    return data(await post(`/admin/orders/${order.id}/test-payment`, admin, { version: order.version, transactionNo: randomUUID() }).expect(200));
  }
  function saleBody(order: any, ids: string[]) { return { orderId: order.id, type: 'REFUND_ONLY', items: [{ orderItemId: order.items[0].id, quantity: 1 }], reasonCode: 'OTHER', description: 'cs凭证测试', evidenceMediaIds: ids }; }
  async function content(kind = 'SCIENCE_ARTICLE', extra = {}) {
    const c = data(await post('/admin/contents', admin, { kind, title: 'cs上传内容', summary: 'cs内容说明', categoryId: contentCategory.id,
      coverMediaId: cover.id, accessPolicy: 'FREE', priceCents: 0, ...extra }).expect(201)); contents.push(c.id); return c;
  }
  async function videoContent(member = false) {
    const source = await upload(admin, 'CONTENT_VIDEO'); let c = await content(member ? 'VIDEO_COURSE' : 'SCIENCE_VIDEO', { accessPolicy: member ? 'MEMBER' : 'FREE' });
    let ch: any;
    if (member) {
      ch = data(await post(`/admin/courses/${c.id}/chapters`, admin, { title: 'cs会员视频', sortOrder: 0 }).expect(201));
      ch.version = data(await call('put', `/admin/chapters/${ch.id}/body`, admin, { version: ch.version, videoMediaId: source.id }).expect(200)).version;
      ch = data(await post(`/admin/chapters/${ch.id}/publish`, admin, { version: ch.version }).expect(200));
    } else c.version = data(await call('put', `/admin/contents/${c.id}/body`, admin, { version: c.version, videoMediaId: source.id }).expect(200)).version;
    c = data(await post(`/admin/contents/${c.id}/publish`, admin, { version: c.version }).expect(200));
    return { source, c, ch, playback: member ? `/chapters/${ch.id}/playback` : `/videos/${c.id}/playback` };
  }
  function file(url: string, range?: string) {
    const u = new URL(url); let req = request(app.getHttpServer()).get(u.pathname + u.search);
    if (range) req = req.set('Range', range); return req;
  }
  beforeAll(async () => {
    const { AppModule } = await import('../../src/app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(ThrottlerGuard).useValue({ canActivate: () => true })
      .overrideProvider(OssStorage).useValue(storage).compile();
    app = module.createNestApplication({ bodyParser: false }); setupApp(app); db = app.get(DataSource); await db.runMigrations(); await app.init();
    admin = await account(PERMISSIONS); editor = await account(['products:write', 'content:write', 'media:write']); reviewer = await account(['aftersales:review']); reader = await account(['orders:read']);
    productCategory = data(await post('/admin/categories', admin, { name: 'cs上传商品分类', scope: 'PRODUCT' }).expect(201)); categories.push(productCategory.id);
    contentCategory = data(await post('/admin/categories', admin, { name: 'cs上传内容分类', scope: 'CONTENT' }).expect(201)); categories.push(contentCategory.id);
    cover = await upload(admin, 'CONTENT_COVER');
  }, 120000);
  afterAll(async () => {
    mkdirSync('.tmp', { recursive: true }); writeFileSync('.tmp/uploads-business-contract-responses.json', JSON.stringify(responses));
    if (db?.isInitialized) {
      for (const id of users) {
        const orders = 'SELECT id FROM commerce_orders WHERE user_id = ?', sales = 'SELECT id FROM after_sales WHERE user_id = ?';
        for (const sql of [`DELETE FROM after_sale_evidence WHERE after_sale_id IN (${sales})`, `DELETE FROM refunds WHERE order_id IN (${orders})`,
          `DELETE FROM after_sale_items WHERE after_sale_id IN (${sales})`, 'DELETE FROM after_sales WHERE user_id = ?',
          `DELETE FROM payment_records WHERE order_id IN (${orders})`, `DELETE FROM stock_movements WHERE order_id IN (${orders})`,
          `DELETE FROM order_items WHERE order_id IN (${orders})`, 'DELETE FROM commerce_orders WHERE user_id = ?', 'DELETE FROM order_quotes WHERE user_id = ?',
          'DELETE FROM user_addresses WHERE user_id = ?', 'DELETE FROM user_memberships WHERE user_id = ?']) await db.query(sql, [id]);
        await db.query('UPDATE users SET avatar_media_id = NULL, avatar_url = NULL WHERE id = ?', [id]);
      }
      for (const id of products) {
        await db.query('DELETE FROM stock_movements WHERE sku_id IN (SELECT id FROM product_skus WHERE product_id = ?)', [id]);
        await db.query('DELETE FROM product_skus WHERE product_id = ?', [id]); await db.query('DELETE FROM products WHERE id = ?', [id]);
      }
      for (const id of contents) { await db.query('DELETE FROM course_chapters WHERE course_id = ?', [id]); await db.query('DELETE FROM contents WHERE id = ?', [id]); }
      for (const id of columns) await db.query('DELETE FROM content_columns WHERE id = ?', [id]);
      for (const id of uploads) { await db.query('DELETE FROM product_images WHERE id = ?', [id]); await db.query('DELETE FROM content_media WHERE id = ?', [id]); }
      for (const id of uploads) await db.query('DELETE FROM upload_media WHERE id = ?', [id]);
      for (const id of categories) await db.query('DELETE FROM product_categories WHERE id = ?', [id]);
      for (const [kind, ids] of [['user', users], ['admin', admins]] as const) for (const id of ids) {
        await db.query('DELETE FROM idempotency_records WHERE actor_key = ?', [`${kind}:${id}`]); await db.query('DELETE FROM commerce_audit_logs WHERE actor_key = ?', [`${kind}:${id}`]);
        await db.query(`DELETE FROM ${kind === 'user' ? 'users' : 'admin_accounts'} WHERE id = ?`, [id]);
      }
    }
    if (app) await app.close();
  }, 120000);

  it('binds only owned READY avatars, normalizes URL aliases, and protects referenced files until cleared', async () => {
    const u = await user(), stranger = await user(), avatar = await upload(u, 'AVATAR'), pending = await upload(u, 'AVATAR', false);
    await call('patch', '/me', stranger, { version: 1, avatarMediaId: avatar.id }).expect(404);
    await call('patch', '/me', stranger, { version: 1, avatarUrl: avatar.publicUrl }).expect(404);
    for (const avatarUrl of [avatar.publicUrl + '?x-oss-process=image/resize,w_100', avatar.publicUrl.replace('/uploads/', '/%75ploads/')])
      await call('patch', '/me', stranger, { version: 1, avatarUrl }).expect(404);
    await call('patch', '/me', u, { version: 1, avatarMediaId: pending.id }).expect(409);
    await call('patch', '/me', u, { version: 1, avatarMediaId: avatar.id, avatarUrl: null }).expect(400);
    await call('patch', '/me', u, { version: 1, avatarMediaId: randomUUID() }).expect(404);
    const updated = data(await call('patch', '/me', u, { version: 1, avatarMediaId: avatar.id }).expect(200)); expect(updated.avatarUrl).toBe(avatar.publicUrl);
    expect((await db.getRepository(User).findOneByOrFail({ id: u.user.id })).avatarMediaId).toBe(avatar.id);
    await call('delete', `/media/${avatar.id}`, u).expect(409).expect(code('MEDIA_IN_USE'));
    await call('patch', '/me', u, { version: updated.version, avatarUrl: avatar.publicUrl }).expect(200);
    const current = data(await call('get', '/me', u).expect(200));
    const cleared = data(await call('patch', '/me', u, { version: current.version, avatarMediaId: null }).expect(200)); expect(cleared.avatarUrl).toBeNull();
    await call('delete', `/media/${avatar.id}`, u).expect(200);
    await call('patch', '/me', u, { version: cleared.version, avatarUrl: avatar.publicUrl }).expect(409);
  });

  it('enforces product/content purposes and protects cover, gallery and body image references', async () => {
    const image = await upload(admin, 'PRODUCT_IMAGE'), body = await upload(admin, 'CONTENT_BODY_IMAGE');
    await post('/admin/products', admin, productBody(cover.id)).expect(409);
    await post('/admin/content-media/images', admin, { purpose: 'CONTENT_COVER', publicUrl: image.publicUrl, mimeType: 'image/png', sizeBytes: tinyPng.length }).expect(409);
    await post('/admin/product-images', admin, { publicUrl: image.publicUrl + '?anything=alias', mimeType: 'image/png', sizeBytes: tinyPng.length }).expect(404);
    const p = await product(image.id); await call('delete', `/media/${image.id}`, admin).expect(409).expect(code('MEDIA_IN_USE'));
    await call('delete', `/admin/products/${p.id}?version=${p.version}`, admin).expect(200);
    await call('delete', `/media/${image.id}`, admin).expect(200);
    await post('/admin/products', admin, productBody(image.id)).expect(409);
    const c = await content();
    const saved = data(await call('put', `/admin/contents/${c.id}/body`, admin, { version: c.version, bodyHtml: `<p>cs图文<img src="${body.publicUrl}" /></p>`, imageMediaIds: [body.id] }).expect(200));
    await call('delete', `/media/${body.id}`, admin).expect(409); await call('delete', `/media/${cover.id}`, admin).expect(409);
    await call('delete', `/admin/contents/${c.id}?version=${saved.version}`, admin).expect(200);
    await call('delete', `/media/${body.id}`, admin).expect(200);
    const columnCover = await upload(admin, 'COLUMN_COVER');
    const column = data(await post('/admin/columns', admin, { name: 'cs上传专栏', coverMediaId: columnCover.id }).expect(201)); columns.push(column.id);
    await call('delete', `/media/${columnCover.id}`, admin).expect(409);
    await call('delete', `/admin/columns/${column.id}?version=${column.version}`, admin).expect(200);
    await call('delete', `/media/${columnCover.id}`, admin).expect(200);
  });

  it('serializes cross-admin attachment and deletion so a product never binds a deleted image', async () => {
    const image = await upload(admin, 'PRODUCT_IMAGE');
    const results = await Promise.all([post('/admin/products', editor, productBody(image.id)), call('delete', `/media/${image.id}`, admin)]);
    expect(results.map(r => r.status).sort()).toEqual(expect.arrayContaining([409]));
    expect(results[0].status === 201 || results[1].status === 200).toBe(true);
    if (results[0].status === 201) { products.push(data(results[0]).id); expect((await db.getRepository(UploadMedia).findOneByOrFail({ id: image.id })).status).toBe('READY'); }
    else expect((await db.getRepository(UploadMedia).findOneByOrFail({ id: image.id })).status).toBe('DELETED');
  });

  it('retains a historical order cover after the product switches to a different image', async () => {
    const u = await user(), order = await paidOrder(u), item = order.items[0], replacement = await upload(admin, 'PRODUCT_IMAGE');
    const original = await db.getRepository(UploadMedia).findOneByOrFail({ publicUrl: item.coverUrl });
    const p = data(await call('get', `/admin/products/${item.productId}`, admin).expect(200));
    await call('patch', `/admin/products/${p.id}`, admin, { version: p.version, coverMediaId: replacement.id, galleryMediaIds: [replacement.id] }).expect(200);
    await call('delete', `/media/${original.id}`, admin).expect(409).expect(code('MEDIA_IN_USE'));
    expect(data(await call('get', `/orders/${order.id}`, u).expect(200)).items[0].coverUrl).toBe(original.publicUrl);
  });

  it('binds private aftersale evidence once, rejects foreign/unready/purpose-mismatched files and returns no public URL', async () => {
    const u = await user(), stranger = await user(), order = await paidOrder(u), evidence = await upload(u, 'AFTERSALE_EVIDENCE');
    const foreign = await upload(stranger, 'AFTERSALE_EVIDENCE'), pending = await upload(u, 'AFTERSALE_EVIDENCE', false), avatar = await upload(u, 'AVATAR');
    await post('/aftersales', u, saleBody(order, [foreign.id])).expect(404);
    await post('/aftersales', u, saleBody(order, [pending.id])).expect(409);
    await post('/aftersales', u, saleBody(order, [avatar.id])).expect(409);
    await post('/aftersales', u, saleBody(order, [evidence.id, evidence.id])).expect(400);
    expect(await db.query('SELECT id FROM after_sales WHERE order_id = ?', [order.id])).toHaveLength(0);
    await post(`/media/${evidence.id}/read-grant`, reviewer, {}).expect(404);
    const key = randomUUID(), body = saleBody(order, [evidence.id]);
    const sale = data(await post('/aftersales', u, body, key).expect(201));
    expect(data(await post('/aftersales', u, body, key).expect(201))).toEqual(sale);
    expect(sale.evidence).toHaveLength(1); expect(sale.evidence[0]).toMatchObject({ id: evidence.id, kind: 'IMAGE', status: 'READY', publicUrl: null });
    expect(JSON.stringify(sale)).not.toMatch(/storageKey|stagingKey|private-test|signature|accessKey/i);
    await call('get', `/aftersales/${sale.id}`, stranger).expect(404);
    await call('get', `/media/${evidence.id}`, stranger).expect(404); await post(`/media/${evidence.id}/read-grant`, stranger, {}).expect(404);
    await call('get', `/media/${evidence.id}`, reader).expect(403); await post(`/media/${evidence.id}/read-grant`, reader, {}).expect(403);
    await call('get', `/media/${evidence.id}`, reviewer).expect(200);
    const grant = data(await post(`/media/${evidence.id}/read-grant`, reviewer, {}).expect(200));
    await file(grant.url).expect(200).expect('Content-Type', /image\/png/).expect('Cache-Control', 'private, no-store');
    await call('delete', `/media/${evidence.id}`, u).expect(409).expect(code('MEDIA_IN_USE'));
    const another = await paidOrder(u); await post('/aftersales', u, saleBody(another, [evidence.id])).expect(409).expect(code('MEDIA_IN_USE'));
    await post(`/aftersales/${sale.id}/cancel`, u, { version: sale.version }).expect(200);
    await call('delete', `/media/${evidence.id}`, u).expect(409);
  });

  it('invalidates already issued private evidence grants when the user is banned or reviewer permission is revoked', async () => {
    const u = await user(), evidence = await upload(u, 'AFTERSALE_EVIDENCE'), order = await paidOrder(u);
    await post('/aftersales', u, saleBody(order, [evidence.id])).expect(201);
    const userGrant = data(await post(`/media/${evidence.id}/read-grant`, u, {}).expect(200)), special = await account(['aftersales:review']);
    const adminGrant = data(await post(`/media/${evidence.id}/read-grant`, special, {}).expect(200));
    await file(userGrant.url).expect(200); await file(adminGrant.url).expect(200);
    await post(`/admin/users/${u.user.id}/ban`, admin, { version: 1, reason: 'cs撤销文件访问' }).expect(200);
    await file(userGrant.url).expect(401); await post(`/media/${evidence.id}/read-grant`, u, {}).expect(401);
    await db.getRepository(AdminAccount).update(special.id, { permissions: [] }); await file(adminGrant.url).expect(401);
    await file(userGrant.url.replace(evidence.id, randomUUID())).expect(401);
  });

  it('streams OSS science video through grants with full/range/suffix requests and rejects invalid ranges or storage remapping', async () => {
    const fixture = await videoContent(), u = await user();
    const grant = data(await call('get', fixture.playback, u).expect(200));
    expect(grant).toMatchObject({ provider: 'OSS', mode: 'STREAM', externalUrl: null, accessPassword: null });
    expect(grant.playbackUrl).toContain(`/content-playback/${fixture.source.id}?token=`);
    const bytes = readFileSync('database/seeds/cs-sample.mp4');
    await file(grant.playbackUrl).expect(200).expect('Content-Length', String(bytes.length));
    await file(grant.playbackUrl, 'bytes=0-31').expect(206).expect('Content-Length', '32').expect('Content-Range', `bytes 0-31/${bytes.length}`);
    await file(grant.playbackUrl, 'bytes=-12').expect(206).expect('Content-Length', '12');
    for (const range of ['bytes=0-1,4-5', 'bytes=99999999-', 'bytes=-0']) await file(grant.playbackUrl, range).expect(416);
    await post(`/media/${fixture.source.id}/read-grant`, admin, {}).expect(404);
    await call('delete', `/media/${fixture.source.id}`, admin).expect(409);
    storage.configuration = { ...storage.configuration, privateBucket: 'cs-renamed-private' };
    try { await file(grant.playbackUrl).expect(503); } finally { storage.configuration = { ...storage.configuration, privateBucket: 'cs-private-test' }; }
    await post(`/admin/users/${u.user.id}/ban`, admin, { version: 1, reason: 'cs撤销视频授权' }).expect(200); await file(grant.playbackUrl).expect(401);
  });

  it('requires current membership for OSS course video at both grant and every stream request', async () => {
    const fixture = await videoContent(true), u = await user();
    await call('get', fixture.playback).expect(401); await call('get', fixture.playback, u).expect(403);
    const term = data(await call('put', `/admin/users/${u.user.id}/membership`, admin, { version: 0, startsAt: new Date(Date.now() - 60000).toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(), reason: 'cs上传会员视频' }).expect(200));
    const grant = data(await call('get', fixture.playback, u).expect(200)); await file(grant.playbackUrl, 'bytes=0-15').expect(206);
    await post(`/admin/users/${u.user.id}/membership/revoke`, admin, { version: term.membership.version, reason: 'cs到期鉴权' }).expect(200);
    await call('get', fixture.playback, u).expect(403); await file(grant.playbackUrl, 'bytes=0-15').expect(403);
  });
});
