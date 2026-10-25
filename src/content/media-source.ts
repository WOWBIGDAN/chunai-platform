import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { ApiException } from '../common/http';

export type ExternalVideoProvider = 'BILIBILI' | 'FEISHU';
export type MediaSecretField = 'externalUrl' | 'accessPassword';

const invalidSource = (message: string): never => { throw new ApiException(400, 'VALIDATION_ERROR', message); };
const unavailable = () => new ApiException(503, 'MEDIA_SOURCE_UNAVAILABLE', '视频外链配置暂不可用');
export const contentImageOssHost = () => (process.env.CONTENT_IMAGE_OSS_HOST ?? 'chunai-photo.oss-cn-hangzhou.aliyuncs.com').toLowerCase();

function httpsUrl(value: string): URL {
  // Reject invisible characters and backslashes before WHATWG URL normalization.
  if (value !== value.trim() || /[\s\\\u0000-\u001f\u007f]/.test(value)) invalidSource('素材地址必须为有效的 HTTPS 地址');
  let url: URL;
  try { url = new URL(value); } catch { return invalidSource('素材地址必须为有效的 HTTPS 地址'); }
  const authority = /^https:\/\/([^/\?#]+)/i.exec(value)?.[1];
  if (url.protocol !== 'https:' || !authority || authority.includes(':') || url.username || url.password || url.port || url.hash)
    invalidSource('素材地址必须使用 HTTPS，且不能包含凭据、端口或片段');
  return url;
}

export function validateContentImageUrl(value: string, cover: boolean): { publicUrl: string; provider: 'OSS' | 'EXTERNAL_IMAGE' } {
  const url = httpsUrl(value);
  const oss = url.hostname === contentImageOssHost();
  if (cover && !oss) invalidSource('内容与专栏封面必须使用配置的阿里云 OSS 公网域名');
  if (url.pathname === '/') invalidSource('图片地址必须包含对象路径');
  // An expiring signed URL is unsuitable as a persistent public cover URL.
  if (oss && [...url.searchParams.keys()].some(k => /^(?:ossaccesskeyid|signature|expires|security-token|x-oss-(?:signature|credential|security-token|date|expires))$/i.test(k)))
    invalidSource('OSS 图片请使用可公开访问的永久地址，不要提交临时签名地址');
  return { publicUrl: url.toString(), provider: oss ? 'OSS' : 'EXTERNAL_IMAGE' };
}

export function validateExternalVideoUrl(provider: ExternalVideoProvider, value: string): string {
  const url = httpsUrl(value);
  if (provider === 'BILIBILI') {
    const regular = ['bilibili.com', 'www.bilibili.com'].includes(url.hostname) && /^\/video\/(?:BV[A-Za-z0-9]{10}|av\d+)\/?$/.test(url.pathname);
    const short = url.hostname === 'b23.tv' && /^\/[A-Za-z0-9]{4,64}\/?$/.test(url.pathname);
    if (!regular && !short) invalidSource('B 站地址须为 bilibili.com 视频链接或 b23.tv 分享链接');
  } else if (provider === 'FEISHU') {
    const host = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)?feishu\.cn$/.test(url.hostname);
    const path = /^\/(?:file|drive\/(?:file|folder))\/[A-Za-z0-9_-]+\/?$/.test(url.pathname);
    if (!host || !path) invalidSource('飞书地址须为 feishu.cn 的文件或网盘文件夹分享链接');
  } else invalidSource('不支持的视频来源');
  return url.toString();
}

function encryptionKey(): Buffer {
  const encoded = process.env.CONTENT_MEDIA_ENCRYPTION_KEY;
  if (!encoded || !/^[A-Za-z0-9+/]{43}=$/.test(encoded)) throw unavailable();
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32 || key.toString('base64') !== encoded) throw unavailable();
  return key;
}
const aad = (mediaId: string, field: MediaSecretField) => Buffer.from(`content-media:v1:${mediaId}:${field}`, 'utf8');

/** Ciphertext is bound to its media row and field to prevent swapping encrypted credentials. */
export function encryptMediaSecret(value: string, mediaId: string, field: MediaSecretField): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(aad(mediaId, field));
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), encrypted.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.');
}

export function decryptMediaSecret(value: string, mediaId: string, field: MediaSecretField): string {
  const key = encryptionKey();
  try {
    const parts = value.split('.');
    if (parts.length !== 4 || parts[0] !== 'v1' || !parts.slice(1).every(p => /^[A-Za-z0-9_-]+$/.test(p))) throw new Error('Invalid media secret');
    const iv = Buffer.from(parts[1], 'base64url'), encrypted = Buffer.from(parts[2], 'base64url'), tag = Buffer.from(parts[3], 'base64url');
    if (iv.length !== 12 || tag.length !== 16) throw new Error('Invalid media secret');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(aad(mediaId, field)); decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch { throw unavailable(); }
}
