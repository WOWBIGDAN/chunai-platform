import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { ApiException } from '../../src/common/http';
import { decryptMediaSecret, encryptMediaSecret, validateContentImageUrl, validateExternalVideoUrl } from '../../src/content/media-source';

describe('external media secret storage', () => {
  const originalKey = process.env.CONTENT_MEDIA_ENCRYPTION_KEY;
  beforeEach(() => { process.env.CONTENT_MEDIA_ENCRYPTION_KEY = randomBytes(32).toString('base64'); });
  afterEach(() => {
    if (originalKey === undefined) delete process.env.CONTENT_MEDIA_ENCRYPTION_KEY;
    else process.env.CONTENT_MEDIA_ENCRYPTION_KEY = originalKey;
  });

  const mediaId = 'c7ead7b4-aef6-48b7-8c30-b9b6685750e7';
  const secret = 'https://sample.feishu.cn/file/PrivateToken';
  function expectUnavailable(work: () => unknown) {
    try { work(); throw new Error('Expected an unavailable error'); }
    catch (error) {
      expect(error).toBeInstanceOf(ApiException);
      expect((error as ApiException).getStatus()).toBe(503);
      const description = JSON.stringify((error as ApiException).getResponse());
      expect(description).not.toContain(secret);
      expect(description).not.toContain(process.env.CONTENT_MEDIA_ENCRYPTION_KEY ?? 'absent-key-value');
    }
  }

  it('encrypts with randomized authenticated ciphertext and recovers the exact UTF-8 value', () => {
    const value = '密码 AbC-123';
    const first = encryptMediaSecret(value, mediaId, 'accessPassword');
    const second = encryptMediaSecret(value, mediaId, 'accessPassword');
    expect(first).not.toBe(second);
    expect(first).not.toContain(value);
    expect(decryptMediaSecret(first, mediaId, 'accessPassword')).toBe(value);
  });

  it('binds ciphertext to both media ID and field name', () => {
    const encoded = encryptMediaSecret(secret, mediaId, 'externalUrl');
    expectUnavailable(() => decryptMediaSecret(encoded, 'a-different-media-id', 'externalUrl'));
    expectUnavailable(() => decryptMediaSecret(encoded, mediaId, 'accessPassword'));
  });

  it('rejects tampered ciphertext, nonce, authentication tag and encoding version', () => {
    const encoded = encryptMediaSecret(secret, mediaId, 'externalUrl');
    for (const index of [1, 2, 3]) {
      const parts = encoded.split('.');
      parts[index] = (parts[index][0] === 'A' ? 'B' : 'A') + parts[index].slice(1);
      expectUnavailable(() => decryptMediaSecret(parts.join('.'), mediaId, 'externalUrl'));
    }
    expectUnavailable(() => decryptMediaSecret(encoded.replace(/^v1\./, 'v2.'), mediaId, 'externalUrl'));
    expectUnavailable(() => decryptMediaSecret('malformed', mediaId, 'externalUrl'));
  });

  it('fails closed without a separate correctly sized encryption key and does not fall back to JWT', () => {
    const encoded = encryptMediaSecret(secret, mediaId, 'externalUrl');
    delete process.env.CONTENT_MEDIA_ENCRYPTION_KEY;
    expectUnavailable(() => encryptMediaSecret(secret, mediaId, 'externalUrl'));
    expectUnavailable(() => decryptMediaSecret(encoded, mediaId, 'externalUrl'));
    for (const key of ['not-base64', randomBytes(16).toString('base64'), randomBytes(64).toString('base64')]) {
      process.env.CONTENT_MEDIA_ENCRYPTION_KEY = key;
      expectUnavailable(() => encryptMediaSecret(secret, mediaId, 'externalUrl'));
    }
    process.env.CONTENT_MEDIA_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    expectUnavailable(() => decryptMediaSecret(encoded, mediaId, 'externalUrl'));
  });
});

describe('content source URL validation', () => {
  const originalHost = process.env.CONTENT_IMAGE_OSS_HOST;
  beforeEach(() => { delete process.env.CONTENT_IMAGE_OSS_HOST; });
  afterEach(() => {
    if (originalHost === undefined) delete process.env.CONTENT_IMAGE_OSS_HOST;
    else process.env.CONTENT_IMAGE_OSS_HOST = originalHost;
  });
  const oss = 'chunai-photo.oss-cn-hangzhou.aliyuncs.com';

  it('accepts permanent OSS covers and public body images, and supports an explicitly configured OSS host', () => {
    expect(validateContentImageUrl(`https://${oss}/covers/test.webp?x-oss-process=image/resize,w_300`, true))
      .toEqual({ publicUrl: `https://${oss}/covers/test.webp?x-oss-process=image/resize,w_300`, provider: 'OSS' });
    expect(validateContentImageUrl('https://example.com/body.png', false).provider).toBe('EXTERNAL_IMAGE');
    process.env.CONTENT_IMAGE_OSS_HOST = 'other-bucket.oss-cn-hangzhou.aliyuncs.com';
    expect(validateContentImageUrl('https://other-bucket.oss-cn-hangzhou.aliyuncs.com/cover.jpg', true).provider).toBe('OSS');
    expect(() => validateContentImageUrl(`https://${oss}/cover.jpg`, true)).toThrow(ApiException);
  });

  it.each([
    `http://${oss}/cover.jpg`, `https://${oss}.evil.test/cover.jpg`, 'https://example.com/cover.jpg',
    `https://user:password@${oss}/cover.jpg`, `https://${oss}:443/cover.jpg`, `https://${oss}/cover.jpg#fragment`,
    `https://${oss}/cover.jpg?OSSAccessKeyId=key`, `https://${oss}/cover.jpg?Signature=sig`,
    `https://${oss}/cover.jpg?x-oss-signature=sig`, `https://${oss}/cover.jpg?Expires=123`,
    `https://${oss}/`, ` https://${oss}/cover.jpg`, `https://${oss}/cover\n.jpg`,
  ])('rejects an invalid, non-public or non-OSS cover URL: %s', value => {
    expect(() => validateContentImageUrl(value, true)).toThrow(ApiException);
  });

  it.each([
    'https://www.bilibili.com/video/BV1xx411c7mD/?p=2', 'https://bilibili.com/video/av123456', 'https://b23.tv/AbCdE123',
  ])('accepts a Bilibili video or share URL: %s', value => {
    expect(validateExternalVideoUrl('BILIBILI', value)).toBe(value);
  });

  it.each([
    'https://www.bilibili.com.evil.test/video/BV1xx411c7mD', 'https://b23.tv.evil.test/AbCdE123',
    'https://www.bilibili.com/redirect?url=https://evil.test', 'https://evil.test/video/BV1xx411c7mD',
    'https://www.bilibili.com/video/invalid', 'javascript:alert(1)', 'https://user@b23.tv/AbCdE123',
  ])('rejects a spoofed or unsupported Bilibili URL: %s', value => {
    expect(() => validateExternalVideoUrl('BILIBILI', value)).toThrow(ApiException);
  });

  it.each([
    'https://sample.feishu.cn/file/ndqUw1kpjnGNNaegyqDyoQDCLx1',
    'https://sample.feishu.cn/drive/folder/cSJe2JgtFFBwRuTKAJK6baNGUn0?from=from_copylink',
    'https://sample.feishu.cn/drive/file/fileToken_123', 'https://feishu.cn/file/fileToken123',
  ])('accepts a Feishu cloud drive file or folder URL: %s', value => {
    expect(validateExternalVideoUrl('FEISHU', value)).toBe(value);
  });

  it.each([
    'https://sample.feishu.cn.evil.test/file/secret', 'https://feishu.cn@evil.test/file/secret',
    'https://user@sample.feishu.cn/file/secret', 'http://sample.feishu.cn/file/secret',
    'https://sample.feishu.cn:443/file/secret', 'https://sample.feishu.cn/wiki/secret',
    'https://sample.feishu.cn/file/secret#fragment', 'https://sample.feishu.cn/file/secret/extra',
    'https://sample.feishu.cn/drive/folder/',
  ])('rejects a spoofed or unsupported Feishu URL: %s', value => {
    expect(() => validateExternalVideoUrl('FEISHU', value)).toThrow(ApiException);
  });
});
