import 'reflect-metadata';
import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { PasswordService } from '../../src/auth/password.service';
import { AdminAccount, ProductImage } from '../../src/commerce/entities';
import { PERMISSIONS } from '../../src/commerce/permissions';
import { CommerceTransaction } from '../../src/commerce/transaction';
import { ApiException } from '../../src/common/http';
import { setupApp } from '../../src/setup-app';
import { UploadMedia } from '../../src/uploads/entities';
import { OssStorage } from '../../src/uploads/oss-storage';
import { UploadsService } from '../../src/uploads/uploads.service';
import { UploadMaintenance } from '../../src/uploads/uploads.maintenance';
import { MemoryOssStorage, tinyPng } from '../helpers/uploads';

if (!process.env.TEST_DB_NAME || !/^[A-Za-z0-9_]+_test$/.test(process.env.TEST_DB_NAME) || !process.env.TEST_DB_PASSWORD) throw new Error('Uploads E2E requires an isolated _test database');
Object.assign(process.env, { NODE_ENV: 'test', DB_HOST: process.env.TEST_DB_HOST ?? '127.0.0.1', DB_PORT: process.env.TEST_DB_PORT ?? '3306',
  DB_USER: process.env.TEST_DB_USER ?? 'chunai_test', DB_PASSWORD: process.env.TEST_DB_PASSWORD, DB_NAME: process.env.TEST_DB_NAME,
  JWT_SECRET: randomBytes(48).toString('hex'), TERMS_VERSION: '2026-10-01', PRIVACY_VERSION: '2026-10-01', COMMERCE_TEST_PAYMENTS: 'true',
  CONTENT_MEDIA_ENCRYPTION_KEY: randomBytes(32).toString('base64'), CONTENT_IMAGE_OSS_HOST: 'chunai-photo.oss-cn-hangzhou.aliyuncs.com',
  PUBLIC_API_URL: 'http://localhost:3000/api/v1' });

describe('unified upload lifecycle with real MySQL', () => {
  let app: INestApplication, db: DataSource, service: UploadsService, admin: any, user: any, stranger: any;
  const storage = new MemoryOssStorage(), userIds: string[] = [], adminIds: string[] = [];
  const responses: { method: string; path: string; status: number; data: unknown }[] = [];
  const password = 'csUploadPassword#123';
  let nextPhone = 17400000000 + Math.floor(Math.random() * 100000000);
  const data = (r: request.Response) => r.body.data;
  const call = (method: 'get' | 'post' | 'delete', path: string, who?: any, body?: any) => {
    let req = request(app.getHttpServer())[method](`/api/v1${path}`);
    if (who) req = req.auth(who.accessToken, { type: 'bearer' });
    req.on('response', (r: request.Response) => {
      if (r.status >= 200 && r.status < 300 && r.body?.data && !path.includes('/auth/')) responses.push({ method, path, status: r.status, data: r.body.data });
    });
    return body === undefined ? req : req.send(body);
  };
  const code = (value: string) => (r: request.Response) => expect(r.body.code).toBe(value);
  const body = (purpose = 'AVATAR', extra = {}) => ({ purpose, fileName: 'cs-sample.png', mimeType: 'image/png', sizeBytes: tinyPng.length, ...extra });
  async function account(permissions: readonly string[]) {
    const id = randomUUID(), username = `cs_${id}`; adminIds.push(id);
    await db.getRepository(AdminAccount).save({ id, username, displayName: 'cs上传权限', passwordHash: await new PasswordService().hash(password), enabled: true, permissions: [...permissions], version: 1 });
    return { ...data(await call('post', '/admin/auth/login', undefined, { username, password }).expect(200)), id };
  }
  async function customer() {
    const value = data(await call('post', '/auth/register', undefined, { phone: `+86${++nextPhone}`, password, nickname: 'cs上传测试', termsVersion: '2026-10-01', privacyVersion: '2026-10-01' }).expect(201));
    userIds.push(value.user.id); return value;
  }
  async function ticket(who = user, purpose = 'AVATAR') {
    return data(await call('post', '/uploads', who, body(purpose)).expect(201));
  }
  async function ready(who = user, purpose = 'AVATAR') {
    const t = await ticket(who, purpose); storage.put(t.fields.key, tinyPng, 'image/png');
    return data(await call('post', `/uploads/${t.uploadId}/complete`, who, {}).expect(200));
  }
  const row = (id: string) => db.getRepository(UploadMedia).createQueryBuilder('v').addSelect(['v.stagingKey', 'v.storageKey', 'v.etag']).where('v.id = :id', { id }).getOneOrFail();
  beforeAll(async () => {
    const { AppModule } = await import('../../src/app.module');
    const mod = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(ThrottlerGuard).useValue({ canActivate: () => true })
      .overrideProvider(OssStorage).useValue(storage).compile();
    app = mod.createNestApplication({ bodyParser: false }); setupApp(app); db = app.get(DataSource); service = app.get(UploadsService);
    await db.runMigrations(); await app.init(); admin = await account(PERMISSIONS); user = await customer(); stranger = await customer();
  }, 120000);
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    mkdirSync('.tmp', { recursive: true }); writeFileSync('.tmp/uploads-contract-responses.json', JSON.stringify(responses));
    if (db?.isInitialized) {
      for (const id of [...userIds, ...adminIds]) {
        await db.query('DELETE FROM product_images WHERE id IN (SELECT id FROM upload_media WHERE owner_id = ?)', [id]);
        await db.query('DELETE FROM content_media WHERE id IN (SELECT id FROM upload_media WHERE owner_id = ?)', [id]);
        await db.query('DELETE FROM upload_media WHERE owner_id = ?', [id]);
      }
      for (const [kind, ids] of [['user', userIds], ['admin', adminIds]] as const) for (const id of ids) {
        await db.query('DELETE FROM idempotency_records WHERE actor_key = ?', [`${kind}:${id}`]);
        await db.query('DELETE FROM commerce_audit_logs WHERE actor_key = ?', [`${kind}:${id}`]);
        await db.query(`DELETE FROM ${kind === 'user' ? 'users' : 'admin_accounts'} WHERE id = ?`, [id]);
      }
    }
    if (app) await app.close();
  });

  it('fails closed without storage credentials and persists no ticket', async () => {
    const before = await db.getRepository(UploadMedia).count();
    jest.spyOn(storage, 'support').mockReturnValue(false);
    await call('post', '/uploads', user, body()).expect(503).expect(code('STORAGE_UNAVAILABLE'));
    expect(await db.getRepository(UploadMedia).count()).toBe(before);
  });
  it('authenticates both principals and requires business permission plus media permission', async () => {
    await call('post', '/uploads', undefined, body()).expect(401);
    await call('post', '/uploads', user, body('PRODUCT_IMAGE')).expect(403);
    await call('post', '/uploads', admin, body('AVATAR')).expect(403);
    const mediaOnly = await account(['media:write']), productOnly = await account(['products:write']);
    await call('post', '/uploads', mediaOnly, body('PRODUCT_IMAGE')).expect(403);
    await call('post', '/uploads', productOnly, body('PRODUCT_IMAGE')).expect(403);
  });
  it('rejects arbitrary URL/key/owner, unsupported MIME, large images and wrong purpose', async () => {
    for (const extra of [{ key: 'chosen.png' }, { publicUrl: 'https://example.org/x' }, { ownerId: stranger.user.id }, { fileName: '../x.png' },
      { mimeType: 'image/svg+xml' }, { sizeBytes: 10485761 }, { durationSeconds: 1 }, { mimeType: 'video/mp4' }]) {
      await call('post', '/uploads', user, body('AVATAR', extra)).expect(400);
    }
    await call('post', '/uploads', admin, body('CONTENT_VIDEO')).expect(400);
  });
  it('keeps pending media private, enforces ownership and completes idempotently', async () => {
    const t = await ticket(); expect(t.uploadId).toBe(t.mediaId); expect(t.method).toBe('POST');
    expect(new Date(t.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(600000);
    const pending = data(await call('get', `/media/${t.mediaId}`, user).expect(200));
    expect(pending).toMatchObject({ status: 'UPLOADING', publicUrl: null });
    await call('get', `/media/${t.mediaId}`, stranger).expect(404);
    await call('post', `/uploads/${t.mediaId}/complete`, stranger, {}).expect(404);
    await call('post', `/uploads/${t.mediaId}/complete`, user, { publicUrl: 'https://example.com' }).expect(400);
    await call('post', `/uploads/${t.mediaId}/complete`, user, {}).expect(409).expect(code('UPLOAD_NOT_RECEIVED'));
    storage.put(t.fields.key, tinyPng, 'image/png');
    const done = data(await call('post', `/uploads/${t.mediaId}/complete`, user, {}).expect(200));
    expect(done).toMatchObject({ id: t.mediaId, status: 'READY', provider: 'OSS' });
    expect(done.publicUrl).toMatch(/^https:\/\/chunai-photo\.oss-cn-hangzhou\.aliyuncs\.com\/uploads\/public\//);
    expect(done.publicUrl).not.toContain(t.mediaId); expect(done).not.toHaveProperty('storageKey');
    expect(data(await call('post', `/uploads/${t.mediaId}/complete`, user).expect(200))).toEqual(done);
  });
  it.each(['size', 'mime', 'magic'])('rejects actual object %s mismatch and makes failure terminal', async mode => {
    const t = await ticket();
    storage.put(t.fields.key, mode === 'size' ? Buffer.concat([tinyPng, Buffer.from('x')]) : mode === 'magic' ? Buffer.alloc(tinyPng.length) : tinyPng,
      mode === 'mime' ? 'image/jpeg' : 'image/png');
    await call('post', `/uploads/${t.mediaId}/complete`, user, {}).expect(422).expect(code('UPLOAD_OBJECT_INVALID'));
    expect((await row(t.mediaId)).status).toBe('FAILED');
    await call('post', `/uploads/${t.mediaId}/complete`, user, {}).expect(409).expect(code('UPLOAD_STATE_INVALID'));
  });
  it('serializes concurrent completes and creates one product projection', async () => {
    const t = await ticket(admin, 'PRODUCT_IMAGE'); storage.put(t.fields.key, tinyPng, 'image/png');
    const [a, b] = await Promise.all([call('post', `/uploads/${t.mediaId}/complete`, admin, {}), call('post', `/uploads/${t.mediaId}/complete`, admin, {})]);
    expect([a.status, b.status]).toEqual([200, 200]); expect(data(a)).toEqual(data(b));
    expect(await db.getRepository(ProductImage).countBy({ id: t.mediaId })).toBe(1);
  });
  it('recovers copy success followed by database rollback without overwriting the object', async () => {
    const t = await ticket(admin, 'PRODUCT_IMAGE'); storage.put(t.fields.key, tinyPng, 'image/png');
    const audit = jest.spyOn(app.get(CommerceTransaction), 'audit').mockRejectedValueOnce(new ApiException(503, 'TEST_DB_FAILURE', 'cs模拟事务失败'));
    await call('post', `/uploads/${t.mediaId}/complete`, admin, {}).expect(503);
    expect((await row(t.mediaId)).status).toBe('UPLOADING'); audit.mockRestore();
    await call('post', `/uploads/${t.mediaId}/complete`, admin, {}).expect(200);
    expect(await db.getRepository(ProductImage).countBy({ id: t.mediaId })).toBe(1);
  });
  it('rejects expired uploads and defers deletion until upload policies expire', async () => {
    const t = await ticket(); storage.put(t.fields.key, tinyPng, 'image/png');
    await call('delete', `/media/${t.mediaId}`, stranger).expect(404);
    await call('delete', `/media/${t.mediaId}`, user).expect(200);
    await call('delete', `/media/${t.mediaId}`, user).expect(200);
    await service.cleanup(t.mediaId); expect(storage.objects.has(`STAGING:${t.fields.key}`)).toBe(true);
    await db.getRepository(UploadMedia).update(t.mediaId, { expiresAt: new Date(Date.now() - 61000) });
    await service.cleanup(t.mediaId); expect(storage.objects.has(`STAGING:${t.fields.key}`)).toBe(false);
    expect((await row(t.mediaId)).cleanedAt).not.toBeNull();
    const expired = await ticket(); await db.getRepository(UploadMedia).update(expired.mediaId, { expiresAt: new Date(Date.now() - 1) });
    await call('post', `/uploads/${expired.mediaId}/complete`, user, {}).expect(409).expect(code('UPLOAD_EXPIRED'));
  });
  it('removes only staging bytes of ready media and retries failed physical cleanup', async () => {
    const media = await ready(), v = await row(media.id);
    await db.getRepository(UploadMedia).update(v.id, { expiresAt: new Date(Date.now() - 61000) });
    jest.spyOn(storage, 'remove').mockRejectedValueOnce(new Error('cs transient storage failure'));
    await expect(service.cleanup(v.id)).rejects.toThrow(); expect((await row(v.id)).stagingCleanedAt).toBeNull();
    await service.cleanup(v.id); expect(storage.objects.has(`STAGING:${v.stagingKey}`)).toBe(false);
    expect(storage.objects.has(`PUBLIC:${v.storageKey}`)).toBe(true);
    await call('delete', `/media/${v.id}`, user).expect(200); await service.cleanup(v.id);
    expect(storage.objects.has(`PUBLIC:${v.storageKey}`)).toBe(false);
  });
  it('allows only evidence read grants and invalidates old links immediately on deletion', async () => {
    const image = await ready(); await call('post', `/media/${image.id}/read-grant`, user, {}).expect(404);
    const evidence = await ready(user, 'AFTERSALE_EVIDENCE'); expect(evidence.publicUrl).toBeNull();
    await call('post', `/media/${evidence.id}/read-grant`, stranger, {}).expect(404);
    const grant = data(await call('post', `/media/${evidence.id}/read-grant`, user, {}).expect(200));
    expect(grant.url).not.toContain('aliyuncs'); const url = new URL(grant.url);
    await request(app.getHttpServer()).get(url.pathname + url.search).expect(200).expect('Content-Type', /image\/png/);
    await call('delete', `/media/${evidence.id}`, user).expect(200);
    await request(app.getHttpServer()).get(url.pathname + url.search).expect(404);
    await request(app.getHttpServer()).get(`/api/v1/media/${evidence.id}/file?token=invalid`).expect(401);
  });
  it('enforces concurrent outstanding ticket limits without blocking other users', async () => {
    const quotaUser = await customer();
    for (let i = 0; i < 20; i++) await ticket(quotaUser);
    await call('post', '/uploads', quotaUser, body()).expect(429).expect(code('UPLOAD_LIMIT_EXCEEDED'));
    await ticket(stranger);
  });
  it('continues cleanup after a failing row and processes expired incomplete tickets', async () => {
    const a = await ticket(stranger), b = await ticket(stranger);
    await db.getRepository(UploadMedia).update([a.mediaId, b.mediaId], { expiresAt: new Date(Date.now() - 70000) });
    const original = service.cleanup.bind(service);
    jest.spyOn(service, 'cleanup').mockImplementation(id => id === a.mediaId ? Promise.reject(new Error('cs bad object')) : original(id));
    await app.get(UploadMaintenance).sweep();
    expect((await row(a.mediaId)).status).toBe('UPLOADING'); expect((await row(b.mediaId)).status).toBe('FAILED');
    expect((await row(b.mediaId)).cleanedAt).not.toBeNull();
  });
});
