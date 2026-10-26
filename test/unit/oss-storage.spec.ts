import 'reflect-metadata';
import { createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import { ApiException } from '../../src/common/http';
import { OssStorage, privateBucketPolicyIsSafe } from '../../src/uploads/oss-storage';

const OSS = require('ali-oss');
const sourceKey = 'uploads/staging/c7ead7b4-aef6-48b7-8c30-b9b6685750e7.png';
const publicKey = 'uploads/public/01234567-89ab-4cde-8fab-0123456789ab.png';
const privateKey = publicKey.replace('/public/', '/private/');
const etag = '0123456789ABCDEF0123456789ABCDEF';
const names = ['UPLOAD_OSS_REGION', 'UPLOAD_OSS_PUBLIC_BUCKET', 'UPLOAD_OSS_PRIVATE_BUCKET', 'CONTENT_IMAGE_OSS_HOST',
  'UPLOAD_OSS_ACCESS_KEY_ID', 'UPLOAD_OSS_ACCESS_KEY_SECRET', 'UPLOAD_OSS_SECURITY_TOKEN', 'UPLOAD_OSS_RAM_ROLE'];
const saved = Object.fromEntries(names.map(name => [name, process.env[name]]));
const secret = 'test-adapter-secret-never-return';
function signature(policy: object, date: Date) {
  const client = new OSS({ region: 'oss-cn-hangzhou', bucket: 'cs-private', accessKeyId: 'test-key', accessKeySecret: secret,
    secure: true, authorizationV4: true });
  return client.signPostObjectPolicyV4(policy, date);
}
function makeClient(acl: string) {
  const parser = new OSS({ region: 'oss-cn-hangzhou', bucket: 'cs-private', accessKeyId: 'test-key', accessKeySecret: secret });
  return {
    getBucketACL: jest.fn().mockResolvedValue({ acl }),
    getBucketVersioning: jest.fn().mockResolvedValue({ versionStatus: undefined }),
    getBucketPolicy: jest.fn().mockResolvedValue({ policy: null, res: { status: 200, headers: {} } }),
    requestError: jest.fn((response: unknown) => parser.requestError(response)),
    signPostObjectPolicyV4: jest.fn(signature),
    head: jest.fn().mockResolvedValue({ res: { status: 200, headers: {
      'content-length': '128', 'content-type': 'image/png', etag: `"${etag}"`, 'x-oss-object-type': 'Normal',
    } } }),
    getStream: jest.fn().mockImplementation(async () => ({
      res: { status: 206, headers: {} }, stream: Readable.from([Buffer.from([137, 80, 78, 71])]),
    })),
    copy: jest.fn().mockResolvedValue({ data: { etag: `"${etag}"` }, res: { status: 200, headers: {} } }),
    delete: jest.fn().mockResolvedValue({}),
  };
}
function fixture() {
  const storage = new OssStorage();
  const privateClient = makeClient('private');
  const publicClient = makeClient('public-read');
  const factory = jest.spyOn(storage as unknown as { createClient: (...args: unknown[]) => unknown }, 'createClient')
    .mockImplementation((_config, _credentials, bucket) => bucket === 'cs-private' ? privateClient : publicClient);
  return { storage, privateClient, publicClient, factory };
}
const grant = () => ({ key: sourceKey, contentType: 'image/png', sizeBytes: 128, expiresAt: new Date(Date.now() + 600_000) });
async function failure(work: Promise<unknown>, code: string, status: number) {
  let result: unknown;
  try { await work; } catch (error) { result = error; }
  expect(result).toBeInstanceOf(ApiException);
  const error = result as ApiException;
  expect(error.getStatus()).toBe(status);
  expect(error.getResponse()).toMatchObject({ code });
  expect(JSON.stringify(error.getResponse())).not.toContain(secret);
  return error;
}

describe('OSS upload adapter', () => {
  beforeEach(() => {
    for (const name of names) delete process.env[name];
    Object.assign(process.env, { UPLOAD_OSS_REGION: 'cn-hangzhou', UPLOAD_OSS_PUBLIC_BUCKET: 'chunai-photo',
      UPLOAD_OSS_PRIVATE_BUCKET: 'cs-private', UPLOAD_OSS_ACCESS_KEY_ID: 'test-key', UPLOAD_OSS_ACCESS_KEY_SECRET: secret });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    for (const name of names) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  });

  it('uses V4 and constrains exact key, exact size, MIME, private ACL and no-overwrite in the signed policy', async () => {
    const { storage } = fixture();
    const input = grant();
    const result = await storage.createUploadGrant(input);
    expect(result.uploadUrl).toBe('https://cs-private.oss-cn-hangzhou.aliyuncs.com/');
    expect(result.method).toBe('POST');
    expect(result.fields.key).toBe(sourceKey);
    const policy = JSON.parse(Buffer.from(result.fields.policy, 'base64').toString());
    expect(policy.expiration).toBe(input.expiresAt.toISOString());
    expect(policy.conditions).toEqual(expect.arrayContaining([
      { bucket: 'cs-private' }, ['content-length-range', 128, 128], ['eq', '$key', sourceKey],
      ['eq', '$Content-Type', 'image/png'], ['eq', '$x-oss-content-type', 'image/png'],
      ['eq', '$x-oss-object-acl', 'private'], ['eq', '$x-oss-forbid-overwrite', 'true'],
    ]));
    expect(result.fields['x-oss-signature-version']).toBe('OSS4-HMAC-SHA256');
    const hmac = (key: string | Buffer, value: string) => createHmac('sha256', key).update(value).digest();
    const date = result.fields['x-oss-date'].slice(0, 8);
    const signingKey = hmac(hmac(hmac(hmac(`aliyun_v4${secret}`, date), 'cn-hangzhou'), 'oss'), 'aliyun_v4_request');
    expect(result.fields['x-oss-signature']).toBe(createHmac('sha256', signingKey).update(result.fields.policy).digest('hex'));
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it('binds an optional STS token into the signed policy instead of returning a signing secret', async () => {
    process.env.UPLOAD_OSS_SECURITY_TOKEN = 'cs-temporary-security-token';
    const { storage } = fixture();
    const result = await storage.createUploadGrant(grant());
    const policy = JSON.parse(Buffer.from(result.fields.policy, 'base64').toString());
    expect(policy.conditions).toContainEqual(['eq', '$x-oss-security-token', 'cs-temporary-security-token']);
    expect(result.fields['x-oss-security-token']).toBe('cs-temporary-security-token');
    expect(result.fields).not.toHaveProperty('accessKeySecret');
  });

  it.each([
    ['UPLOAD_OSS_PRIVATE_BUCKET', 'chunai-photo'], ['UPLOAD_OSS_PRIVATE_BUCKET', ''],
    ['UPLOAD_OSS_REGION', 'cn-hangzhou.example.test/../../'], ['UPLOAD_OSS_PUBLIC_BUCKET', 'https://evil.test'],
    ['CONTENT_IMAGE_OSS_HOST', 'evil.test'], ['UPLOAD_OSS_ACCESS_KEY_SECRET', ''],
    ['UPLOAD_OSS_RAM_ROLE', 'cs-role'],
  ])('fails closed for unsafe or incomplete configuration %s', async (name, value) => {
    process.env[name] = value;
    const { storage, factory } = fixture();
    expect(storage.support()).toBe(false);
    await failure(storage.createUploadGrant(grant()), 'STORAGE_UNAVAILABLE', 503);
    expect(factory).not.toHaveBeenCalled();
  });

  it.each([
    'https://evil.test/object.png', '../secret.png', publicKey, 'uploads/staging/../private/test.png',
    sourceKey + '?x-oss-process=style/danger', sourceKey.replace('.png', '.svg'), sourceKey + '\r\nX-Test: true',
  ])('rejects unowned keys and URLs before accessing storage: %s', async key => {
    const { storage, factory } = fixture();
    await failure(storage.createUploadGrant({ ...grant(), key }), 'UPLOAD_OBJECT_INVALID', 422);
    expect(factory).not.toHaveBeenCalled();
  });

  it('rejects unlimited/oversized/expired grants and header injection', async () => {
    const { storage, factory } = fixture();
    for (const input of [
      { ...grant(), sizeBytes: 0 }, { ...grant(), sizeBytes: 104857601 }, { ...grant(), sizeBytes: 1.5 },
      { ...grant(), expiresAt: new Date(Date.now() - 1) }, { ...grant(), expiresAt: new Date(Date.now() + 601_000) },
      { ...grant(), contentType: 'image/png\r\nX-ACL: public-read' },
    ]) await failure(storage.createUploadGrant(input), 'UPLOAD_OBJECT_INVALID', 422);
    expect(factory).not.toHaveBeenCalled();
  });

  it('refuses public private-bucket ACLs, anonymous policies and versioned buckets', async () => {
    for (const change of ['privateAcl', 'publicAcl', 'privateVersion', 'publicVersion', 'policy', 'publicPolicy']) {
      const { storage, privateClient, publicClient } = fixture();
      if (change === 'privateAcl') privateClient.getBucketACL.mockResolvedValue({ acl: 'public-read' });
      if (change === 'publicAcl') publicClient.getBucketACL.mockResolvedValue({ acl: 'public-read-write' });
      if (change === 'privateVersion') privateClient.getBucketVersioning.mockResolvedValue({ versionStatus: 'Enabled' });
      if (change === 'publicVersion') publicClient.getBucketVersioning.mockResolvedValue({ versionStatus: 'Suspended' });
      if (change === 'policy') privateClient.getBucketPolicy.mockResolvedValue({ policy: { Statement: [{ Effect: 'Allow', Principal: ['*'] }] }, res: { status: 200, headers: {} } });
      if (change === 'publicPolicy') publicClient.getBucketPolicy.mockResolvedValue({ policy: { Statement: [{ Effect: 'Allow', Principal: ['*'], Action: ['oss:PutObject'] }] }, res: { status: 200, headers: {} } });
      await failure(storage.createUploadGrant(grant()), 'STORAGE_UNAVAILABLE', 503);
      expect(privateClient.signPostObjectPolicyV4).not.toHaveBeenCalled();
    }
  });

  it('permits anonymous GetObject on the public image bucket without weakening the private bucket', async () => {
    const { storage, publicClient } = fixture();
    publicClient.getBucketPolicy.mockResolvedValue({ policy: { Statement: [{ Effect: 'Allow', Principal: ['*'], Action: ['oss:GetObject'] }] }, res: { status: 200, headers: {} } });
    await expect(storage.createUploadGrant(grant())).resolves.toMatchObject({ method: 'POST' });
  });

  it.each(['private', 'public'])('fails closed for unsuccessful %s bucket policy reads returned by the SDK', async bucket => {
    for (const response of [
      { status: 403, data: `<Error><Code>AccessDenied</Code><Message>${secret}</Message></Error>` },
      { status: 500, data: '' },
      { status: 404, data: '' },
      { status: 404, data: `<Error><Code>NoSuchBucket</Code><Message>${secret}</Message></Error>` },
      { status: 403, data: '<Error><Code>NoSuchBucketPolicy</Code></Error>' },
    ]) {
      const { storage, privateClient, publicClient } = fixture();
      const client = bucket === 'private' ? privateClient : publicClient;
      client.getBucketPolicy.mockResolvedValue({ policy: null, res: { ...response, headers: {} } });
      await failure(storage.createUploadGrant(grant()), 'STORAGE_UNAVAILABLE', 503);
      expect(privateClient.signPostObjectPolicyV4).not.toHaveBeenCalled();
    }
  });

  it.each(['private', 'public'])('accepts an absent %s policy only after parsing the real OSS 404 error code', async bucket => {
    const { storage, privateClient, publicClient } = fixture();
    const client = bucket === 'private' ? privateClient : publicClient;
    const res = { status: 404, headers: {}, data: Buffer.from('<Error><Code>NoSuchBucketPolicy</Code><Message>The bucket policy does not exist.</Message></Error>') };
    client.getBucketPolicy.mockResolvedValue({ policy: null, res });
    await expect(storage.createUploadGrant(grant())).resolves.toMatchObject({ method: 'POST' });
    expect(client.requestError).toHaveBeenCalledWith(res);
  });

  it('accepts thrown missing-policy errors only when their status and code both identify policy absence', async () => {
    const { storage, privateClient } = fixture();
    for (const error of [
      { code: 'AccessDenied', status: 403, message: secret },
      { code: 'NoSuchBucketPolicy', status: 403, message: secret },
      { code: 'NoSuchBucketPolicy', message: secret },
    ]) {
      privateClient.getBucketPolicy.mockRejectedValue(error);
      await failure(storage.createUploadGrant(grant()), 'STORAGE_UNAVAILABLE', 503);
    }
    privateClient.getBucketPolicy.mockRejectedValue({ code: 'NoSuchBucketPolicy', status: 404 });
    await expect(storage.createUploadGrant(grant())).resolves.toMatchObject({ method: 'POST' });
  });

  it('allows absent bucket policies and namespaced RAM policy grants, rejecting ambiguous policy structures', () => {
    expect(privateBucketPolicyIsSafe(null)).toBe(true);
    expect(privateBucketPolicyIsSafe({ Statement: [{ Effect: 'Allow', Principal: ['acs:ram::123456789:role/cs-uploader'] }] })).toBe(true);
    expect(privateBucketPolicyIsSafe({ Statement: [{ Effect: 'Deny', Principal: ['*'] }] })).toBe(true);
    for (const policy of ['{}', { Statement: 'invalid' }, { Statement: [{ Effect: 'Allow', NotPrincipal: '*' }] },
      { Statement: [{ Effect: 'Allow', Principal: { RAM: ['*'] } }] },
      { Statement: [{ Effect: 'Allow', Principal: ['acs:ram::*:root'] }] }]) expect(privateBucketPolicyIsSafe(policy)).toBe(false);
  });

  it('reads bounded bytes pinned to the inspected ETag and rejects oversized responses', async () => {
    const { storage, privateClient } = fixture();
    expect(await storage.inspect(sourceKey)).toEqual({ sizeBytes: 128, contentType: 'image/png', etag: `"${etag}"` });
    expect(await storage.readPrefix(sourceKey, etag)).toEqual(Buffer.from([137, 80, 78, 71]));
    expect(privateClient.getStream).toHaveBeenLastCalledWith(sourceKey, { headers: { Range: 'bytes=0-63', 'If-Match': `"${etag}"` } });
    const response = Readable.from([Buffer.alloc(65)]);
    privateClient.getStream.mockResolvedValue({ res: { status: 200, headers: {} }, stream: response });
    await failure(storage.readPrefix(sourceKey, etag), 'UPLOAD_OBJECT_INVALID', 422);
    expect(response.destroyed).toBe(true);
  });

  it('promotes only an inspected immutable source and overwrites unsafe metadata in the correct bucket', async () => {
    const { storage, privateClient, publicClient } = fixture();
    expect(await storage.promote({ sourceKey, targetKey: publicKey, etag, contentType: 'image/png', visibility: 'PUBLIC' }))
      .toEqual({ etag: `"${etag}"`, url: `https://chunai-photo.oss-cn-hangzhou.aliyuncs.com/${publicKey}` });
    expect(publicClient.copy).toHaveBeenCalledWith(publicKey, sourceKey, 'cs-private', expect.objectContaining({ headers: expect.objectContaining({
      'x-oss-copy-source-if-match': `"${etag}"`, 'x-oss-forbid-overwrite': 'true', 'x-oss-object-acl': 'public-read',
      'x-oss-metadata-directive': 'REPLACE', 'Content-Type': 'image/png',
    }) }));
    expect((await storage.promote({ sourceKey, targetKey: privateKey, etag, contentType: 'image/png', visibility: 'PRIVATE' })).url).toBeNull();
    expect(privateClient.copy).toHaveBeenCalledWith(privateKey, sourceKey, 'cs-private', expect.objectContaining({ headers: expect.objectContaining({
      'x-oss-object-acl': 'private', 'Cache-Control': 'private, no-store', 'Content-Disposition': 'attachment',
    }) }));
  });

  it('maps storage races and storage failures without exposing provider error text', async () => {
    const { storage, privateClient } = fixture();
    privateClient.head.mockRejectedValue({ code: 'NoSuchKey', message: secret });
    await failure(storage.inspect(sourceKey), 'UPLOAD_NOT_RECEIVED', 409);
    privateClient.head.mockRejectedValue({ code: 'PreconditionFailed', message: secret });
    await failure(storage.inspect(sourceKey), 'UPLOAD_OBJECT_CHANGED', 409);
    privateClient.head.mockRejectedValue({ code: 'AccessDenied', message: secret, request: { authorization: secret } });
    await failure(storage.inspect(sourceKey), 'STORAGE_UNAVAILABLE', 503);
  });

  it('rejects encoded bodies, symlinks and unexpected HEAD metadata before promotion', async () => {
    const { storage, privateClient } = fixture();
    for (const extra of [
      { 'content-encoding': 'gzip' }, { 'x-oss-object-type': 'Symlink' }, { 'content-length': '-1' },
      { 'content-type': 'text/html' }, { etag: 'unsafe\r\nHeader: value' },
    ]) {
      privateClient.head.mockResolvedValue({ res: { status: 200, headers: {
        'content-length': '128', 'content-type': 'image/png', etag: `"${etag}"`, 'x-oss-object-type': 'Normal', ...extra,
      } } });
      await failure(storage.inspect(sourceKey), 'UPLOAD_OBJECT_INVALID', 422);
    }
    expect(privateClient.copy).not.toHaveBeenCalled();
  });

  it('forwards validated byte ranges only to managed private keys and closes the provider stream', async () => {
    const { storage, privateClient, publicClient } = fixture();
    const result = await storage.stream(privateKey, 'PRIVATE', { start: 3, end: 6 });
    const chunks: Buffer[] = [];
    for await (const chunk of result) chunks.push(chunk);
    expect(Buffer.concat(chunks)).toEqual(Buffer.from([137, 80, 78, 71]));
    expect(privateClient.getStream).toHaveBeenCalledWith(privateKey, { headers: { Range: 'bytes=3-6' } });
    expect(publicClient.getStream).not.toHaveBeenCalled();
    await failure(storage.stream(privateKey, 'PRIVATE', { start: -1, end: 1 }), 'UPLOAD_OBJECT_INVALID', 422);
    await failure(storage.stream(publicKey, 'PRIVATE'), 'UPLOAD_OBJECT_INVALID', 422);
  });

  it('sanitizes asynchronous SDK stream errors before they reach a caller', async () => {
    const { storage, privateClient } = fixture();
    privateClient.getStream.mockResolvedValue({ res: { status: 200, headers: {} }, stream: new Readable({
      read() { this.destroy(new Error(secret)); },
    }) });
    const result = await storage.stream(privateKey, 'PRIVATE');
    await failure((async () => { for await (const _chunk of result) { /* drain */ } })(), 'STORAGE_UNAVAILABLE', 503);
  });
});
