import { Injectable } from '@nestjs/common';
import Credential, { Config as CredentialConfig } from '@alicloud/credentials';
import { PassThrough, Readable } from 'node:stream';
import { ApiException } from '../common/http';

export type ObjectVisibility = 'PUBLIC' | 'PRIVATE';
export type StorageArea = ObjectVisibility | 'STAGING';
export interface OssConfiguration {
  region: string;
  publicBucket: string;
  privateBucket: string;
  publicHost: string;
}
export interface UploadGrantInput { key: string; contentType: string; sizeBytes: number; expiresAt: Date }
export interface OssUploadGrant { method: 'POST'; uploadUrl: string; fields: Record<string, string> }
export interface OssObjectInfo { sizeBytes: number; contentType: string; etag: string }
export interface PromoteObjectInput {
  sourceKey: string; targetKey: string; etag: string; contentType: string; visibility: ObjectVisibility;
}
interface CredentialValues { accessKeyId: string; accessKeySecret: string; securityToken?: string }
interface OssResponse { res: { status: number; headers: Record<string, string | number | undefined> } }
// Keep the adapter independent of the SDK's occasionally lagging declaration package.
interface OssClient {
  signPostObjectPolicyV4(policy: object, date: Date): string;
  getBucketACL(bucket: string): Promise<{ acl: string }>;
  getBucketVersioning(bucket: string): Promise<{ versionStatus?: string }>;
  getBucketPolicy(bucket: string): Promise<{ policy: unknown }>;
  head(key: string): Promise<OssResponse>;
  getStream(key: string, options?: object): Promise<OssResponse & { stream: Readable }>;
  copy(key: string, source: string, bucket: string, options: object): Promise<OssResponse & { data: { etag: string } }>;
  delete(key: string): Promise<unknown>;
}
const OSS = require('ali-oss') as new (options: Record<string, unknown>) => OssClient;
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const keyPattern = new RegExp(`^uploads/(staging|public|private)/${uuid}\\.(jpg|jpeg|png|webp|gif|mp4)$`);
const mimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4']);
const noStore = 'private, no-store';
const operationTimeout = 15_000;

function unavailable(): ApiException {
  return new ApiException(503, 'STORAGE_UNAVAILABLE', '文件存储服务暂时不可用');
}
function invalidObject(): ApiException {
  return new ApiException(422, 'UPLOAD_OBJECT_INVALID', '上传对象的内容或属性不符合要求');
}
function changedObject(): ApiException {
  return new ApiException(409, 'UPLOAD_OBJECT_CHANGED', '上传对象已发生变化，请重新上传');
}
function checkKey(key: string, area: StorageArea): void {
  const match = keyPattern.exec(key);
  if (!match || match[1] !== area.toLowerCase()) throw invalidObject();
}
function checkEtag(etag: string): string {
  if (!/^"?[a-fA-F0-9]{32}(?:-[1-9][0-9]*)?"?$/.test(etag)) throw invalidObject();
  const value = etag.replace(/^"|"$/g, '');
  return `"${value}"`;
}
function safeMime(contentType: string): void {
  if (!mimeTypes.has(contentType)) throw invalidObject();
}
function header(headers: OssResponse['res']['headers'], name: string): string {
  const value = headers[name];
  return value === undefined ? '' : String(value);
}
function storageError(error: unknown): ApiException {
  if (error instanceof ApiException) return error;
  const info = error as { code?: unknown; status?: unknown } | null;
  if (info?.code === 'NoSuchKey' || info?.status === 404) {
    return new ApiException(409, 'UPLOAD_NOT_RECEIVED', '尚未收到上传文件，请先完成上传');
  }
  if (info?.code === 'PreconditionFailed' || info?.status === 412) return changedObject();
  if (info?.code === 'FileAlreadyExists' || info?.status === 409) return changedObject();
  // SDK errors can contain signed requests and credentials. Never pass their text or causes onward.
  return unavailable();
}

/** Bucket policy is permitted only when every Allow names concrete RAM principals. */
export function privateBucketPolicyIsSafe(policy: unknown): boolean {
  return bucketPolicyIsSafe(policy, false);
}

function bucketPolicyIsSafe(policy: unknown, allowPublicRead: boolean): boolean {
  if (policy === null || policy === undefined) return true;
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) return false;
  const value = policy as Record<string, unknown>;
  if (Object.keys(value).length === 0) return true;
  if (!Array.isArray(value.Statement)) return false;
  return value.Statement.every((statement: unknown) => {
    if (!statement || typeof statement !== 'object' || Array.isArray(statement)) return false;
    const item = statement as Record<string, unknown>;
    if (item.Effect === 'Deny') return true;
    if (item.Effect !== 'Allow' || item.NotPrincipal !== undefined) return false;
    const concrete = (principal: unknown): boolean => typeof principal === 'string' &&
      /^acs:ram::[0-9]+:(?:root|user\/[^*\s]+|role\/[^*\s]+)$/.test(principal);
    const principal = item.Principal;
    const actions = Array.isArray(item.Action) ? item.Action : [item.Action];
    if (allowPublicRead && item.NotAction === undefined && actions.length > 0 &&
        actions.every(action => action === 'oss:GetObject')) return true;
    if (Array.isArray(principal)) return principal.length > 0 && principal.every(concrete);
    if (typeof principal === 'string') return concrete(principal);
    if (principal && typeof principal === 'object') {
      const entries = Object.entries(principal);
      return entries.length === 1 && entries[0][0] === 'RAM' &&
        (Array.isArray(entries[0][1]) ? entries[0][1].length > 0 && entries[0][1].every(concrete) : concrete(entries[0][1]));
    }
    return false;
  });
}

@Injectable()
export class OssStorage {
  private roleCredential?: { role: string; credential: Credential };

  /** Returns only configuration identifiers; secrets never leave this adapter. */
  config(): OssConfiguration {
    const region = process.env.UPLOAD_OSS_REGION ?? 'cn-hangzhou';
    const publicBucket = process.env.UPLOAD_OSS_PUBLIC_BUCKET ?? 'chunai-photo';
    const privateBucket = process.env.UPLOAD_OSS_PRIVATE_BUCKET ?? '';
    const bucket = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(region) || !bucket.test(publicBucket) ||
        !bucket.test(privateBucket) || privateBucket === publicBucket) throw unavailable();
    const publicHost = `${publicBucket}.oss-${region}.aliyuncs.com`;
    if (process.env.CONTENT_IMAGE_OSS_HOST && process.env.CONTENT_IMAGE_OSS_HOST !== publicHost) throw unavailable();
    return { region, publicBucket, privateBucket, publicHost };
  }

  support(): boolean {
    try { this.config(); this.credentialMode(); return true; }
    catch { return false; }
  }

  private credentialMode(): 'ACCESS_KEY' | 'ECS_RAM_ROLE' {
    const role = process.env.UPLOAD_OSS_RAM_ROLE;
    const id = process.env.UPLOAD_OSS_ACCESS_KEY_ID;
    const secret = process.env.UPLOAD_OSS_ACCESS_KEY_SECRET;
    const token = process.env.UPLOAD_OSS_SECURITY_TOKEN;
    if (role) {
      if (!/^[A-Za-z0-9.@_-]{1,64}$/.test(role) || id || secret || token) throw unavailable();
      return 'ECS_RAM_ROLE';
    }
    if (!id || !secret || /\s/.test(id + secret) || (token !== undefined && !token)) throw unavailable();
    return 'ACCESS_KEY';
  }

  private async credentials(): Promise<CredentialValues> {
    if (this.credentialMode() === 'ACCESS_KEY') {
      return {
        accessKeyId: process.env.UPLOAD_OSS_ACCESS_KEY_ID!,
        accessKeySecret: process.env.UPLOAD_OSS_ACCESS_KEY_SECRET!,
        ...(process.env.UPLOAD_OSS_SECURITY_TOKEN ? { securityToken: process.env.UPLOAD_OSS_SECURITY_TOKEN } : {}),
      };
    }
    const role = process.env.UPLOAD_OSS_RAM_ROLE!;
    if (this.roleCredential?.role !== role) {
      this.roleCredential = { role, credential: new Credential(new CredentialConfig({
        type: 'ecs_ram_role', roleName: role, disableIMDSv1: true, timeout: 5_000, connectTimeout: 3_000,
      })) };
    }
    const value = await this.roleCredential.credential.getCredential();
    if (!value.accessKeyId || !value.accessKeySecret || !value.securityToken) throw unavailable();
    return { accessKeyId: value.accessKeyId, accessKeySecret: value.accessKeySecret, securityToken: value.securityToken };
  }

  private createClient(config: OssConfiguration, credential: CredentialValues, bucket: string): OssClient {
    return new OSS({
      region: `oss-${config.region}`, bucket, accessKeyId: credential.accessKeyId,
      accessKeySecret: credential.accessKeySecret, ...(credential.securityToken ? { stsToken: credential.securityToken } : {}),
      secure: true, authorizationV4: true, timeout: operationTimeout, retryMax: 0,
    });
  }

  private async context() {
    try {
      const config = this.config();
      const credential = await this.credentials();
      return {
        config, credential,
        privateClient: this.createClient(config, credential, config.privateBucket),
        publicClient: this.createClient(config, credential, config.publicBucket),
      };
    } catch { throw unavailable(); }
  }

  private async checkBuckets(context: Awaited<ReturnType<OssStorage['context']>>): Promise<void> {
    try {
      const { config, privateClient, publicClient } = context;
      const getPolicy = (client: OssClient, bucket: string) => client.getBucketPolicy(bucket).catch((error: unknown) => {
        if ((error as { code?: string } | null)?.code === 'NoSuchBucketPolicy') return { policy: null };
        throw error;
      });
      const [acl, privateVersion, publicVersion, policy, publicAcl, publicPolicy] = await Promise.all([
        privateClient.getBucketACL(config.privateBucket),
        privateClient.getBucketVersioning(config.privateBucket),
        publicClient.getBucketVersioning(config.publicBucket),
        getPolicy(privateClient, config.privateBucket),
        publicClient.getBucketACL(config.publicBucket),
        getPolicy(publicClient, config.publicBucket),
      ]);
      if (acl.acl !== 'private' || !['private', 'public-read'].includes(publicAcl.acl) ||
          privateVersion.versionStatus || publicVersion.versionStatus || !privateBucketPolicyIsSafe(policy.policy) ||
          !bucketPolicyIsSafe(publicPolicy.policy, true)) throw unavailable();
    } catch { throw unavailable(); }
  }

  async createUploadGrant(input: UploadGrantInput): Promise<OssUploadGrant> {
    checkKey(input.key, 'STAGING'); safeMime(input.contentType);
    const now = new Date();
    if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes < 1 || input.sizeBytes > 100 * 1024 * 1024 ||
        !Number.isFinite(input.expiresAt.getTime()) || input.expiresAt <= now ||
        input.expiresAt.getTime() - now.getTime() > 600_000) throw invalidObject();
    const context = await this.context();
    await this.checkBuckets(context);
    try {
      const date = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
      const fields: Record<string, string> = {
        key: input.key, 'Content-Type': input.contentType, 'x-oss-content-type': input.contentType,
        'Cache-Control': noStore, 'Content-Disposition': 'attachment',
        'x-oss-object-acl': 'private', 'x-oss-forbid-overwrite': 'true', success_action_status: '201',
        'x-oss-signature-version': 'OSS4-HMAC-SHA256', 'x-oss-date': date,
        'x-oss-credential': `${context.credential.accessKeyId}/${date.slice(0, 8)}/${context.config.region}/oss/aliyun_v4_request`,
        ...(context.credential.securityToken ? { 'x-oss-security-token': context.credential.securityToken } : {}),
      };
      const policy = {
        expiration: input.expiresAt.toISOString(),
        conditions: [
          { bucket: context.config.privateBucket },
          ['content-length-range', input.sizeBytes, input.sizeBytes],
          ...Object.entries(fields).map(([name, value]) => ['eq', `$${name}`, value]),
        ],
      };
      fields.policy = Buffer.from(JSON.stringify(policy), 'utf8').toString('base64');
      fields['x-oss-signature'] = context.privateClient.signPostObjectPolicyV4(policy, now);
      return { method: 'POST', uploadUrl: `https://${context.config.privateBucket}.oss-${context.config.region}.aliyuncs.com/`, fields };
    } catch (error) { throw storageError(error); }
  }

  async inspect(key: string, visibility: StorageArea = 'STAGING'): Promise<OssObjectInfo> {
    checkKey(key, visibility);
    const context = await this.context();
    await this.checkBuckets(context);
    try {
      const result = await (visibility === 'PUBLIC' ? context.publicClient : context.privateClient).head(key);
      const headers = result.res.headers;
      const sizeBytes = Number(header(headers, 'content-length'));
      const contentType = header(headers, 'content-type').split(';')[0].trim().toLowerCase();
      const objectType = header(headers, 'x-oss-object-type');
      if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > 100 * 1024 * 1024 ||
          (objectType && objectType !== 'Normal') || header(headers, 'content-encoding')) throw invalidObject();
      safeMime(contentType);
      return { sizeBytes, contentType, etag: checkEtag(header(headers, 'etag')) };
    } catch (error) { throw storageError(error); }
  }

  async readPrefix(key: string, etag: string, maxBytes = 64): Promise<Buffer> {
    checkKey(key, 'STAGING');
    const match = checkEtag(etag);
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 64 * 1024) throw invalidObject();
    const context = await this.context();
    try {
      const response = await context.privateClient.getStream(key, { headers: { Range: `bytes=0-${maxBytes - 1}`, 'If-Match': match } });
      if (!response.stream || ![200, 206].includes(response.res.status)) {
        response.stream?.destroy(); throw invalidObject();
      }
      const chunks: Buffer[] = [];
      let length = 0;
      try {
        for await (const chunk of response.stream) {
          const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          if (length + bytes.length > maxBytes) throw invalidObject();
          chunks.push(bytes); length += bytes.length;
        }
      } finally { response.stream.destroy(); }
      if (!length) throw invalidObject();
      return Buffer.concat(chunks, length);
    } catch (error) { throw storageError(error); }
  }

  async promote(input: PromoteObjectInput): Promise<{ etag: string; url: string | null }> {
    checkKey(input.sourceKey, 'STAGING'); checkKey(input.targetKey, input.visibility); safeMime(input.contentType);
    const match = checkEtag(input.etag);
    const context = await this.context();
    await this.checkBuckets(context);
    try {
      const client = input.visibility === 'PUBLIC' ? context.publicClient : context.privateClient;
      const result = await client.copy(input.targetKey, input.sourceKey, context.config.privateBucket, {
        headers: {
          'x-oss-copy-source-if-match': match, 'x-oss-forbid-overwrite': 'true',
          'x-oss-object-acl': input.visibility === 'PUBLIC' ? 'public-read' : 'private',
          'x-oss-metadata-directive': 'REPLACE', 'Content-Type': input.contentType,
          'Cache-Control': input.visibility === 'PUBLIC' ? 'public, max-age=31536000, immutable' : noStore,
          'Content-Disposition': input.visibility === 'PUBLIC' ? 'inline' : 'attachment',
        },
      });
      return {
        etag: checkEtag(result.data.etag),
        url: input.visibility === 'PUBLIC' ? `https://${context.config.publicHost}/${input.targetKey}` : null,
      };
    } catch (error) { throw storageError(error); }
  }

  async remove(key: string, visibility: StorageArea): Promise<void> {
    checkKey(key, visibility);
    const context = await this.context();
    try { await (visibility === 'PUBLIC' ? context.publicClient : context.privateClient).delete(key); }
    catch (error) { throw storageError(error); }
  }

  async stream(key: string, visibility: ObjectVisibility, range?: { start: number; end: number }): Promise<Readable> {
    checkKey(key, visibility);
    if (range && (!Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end) ||
        range.start < 0 || range.end < range.start || range.end >= 100 * 1024 * 1024)) throw invalidObject();
    const context = await this.context();
    await this.checkBuckets(context);
    try {
      const response = await (visibility === 'PUBLIC' ? context.publicClient : context.privateClient).getStream(key, {
        ...(range ? { headers: { Range: `bytes=${range.start}-${range.end}` } } : {}),
      });
      if (!response.stream || response.res.status !== (range ? 206 : 200)) {
        response.stream?.destroy(); throw unavailable();
      }
      const stream = new PassThrough();
      response.stream.on('error', () => stream.destroy(unavailable()));
      stream.on('close', () => response.stream.destroy());
      response.stream.pipe(stream);
      return stream;
    } catch (error) { throw storageError(error); }
  }
}
