import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { ApiException } from '../../src/common/http';
import { ObjectVisibility, PromoteObjectInput, StorageArea, UploadGrantInput } from '../../src/uploads/oss-storage';

export const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6xkAAAAASUVORK5CYII=', 'base64');
type StoredObject = { bytes: Buffer; contentType: string; etag: string };
/** Simulates only OSS transport; business permissions and transactions still use the real app and MySQL. */
export class MemoryOssStorage {
  readonly objects = new Map<string, StoredObject>();
  readonly grants: UploadGrantInput[] = [];
  configuration = { region: 'cn-hangzhou', publicBucket: 'chunai-photo', privateBucket: 'cs-private-test', publicHost: 'chunai-photo.oss-cn-hangzhou.aliyuncs.com' };
  config() { return this.configuration; }
  support() { return true; }
  put(key: string, bytes: Buffer, contentType: string, area: StorageArea = 'STAGING') {
    const object = { bytes: Buffer.from(bytes), contentType, etag: `"${createHash('md5').update(bytes).digest('hex')}"` };
    this.objects.set(`${area}:${key}`, object); return object;
  }
  private object(key: string, area: StorageArea) {
    const object = this.objects.get(`${area}:${key}`);
    if (!object) throw new ApiException(409, 'UPLOAD_NOT_RECEIVED', '尚未收到上传文件');
    return object;
  }
  async createUploadGrant(input: UploadGrantInput) {
    this.grants.push(input);
    return { method: 'POST' as const, uploadUrl: 'https://cs-private-test.oss-cn-hangzhou.aliyuncs.com/', fields: { key: input.key, 'Content-Type': input.contentType } };
  }
  async inspect(key: string, area: StorageArea = 'STAGING') {
    const object = this.object(key, area); return { sizeBytes: object.bytes.length, contentType: object.contentType, etag: object.etag };
  }
  async readPrefix(key: string, etag: string, maxBytes = 64) {
    const object = this.object(key, 'STAGING');
    if (object.etag !== etag) throw new ApiException(409, 'UPLOAD_OBJECT_CHANGED', '上传对象已发生变化');
    return object.bytes.subarray(0, maxBytes);
  }
  async promote(input: PromoteObjectInput) {
    const object = this.object(input.sourceKey, 'STAGING');
    if (object.etag !== input.etag || this.objects.has(`${input.visibility}:${input.targetKey}`))
      throw new ApiException(409, 'UPLOAD_OBJECT_CHANGED', '上传对象已发生变化');
    this.put(input.targetKey, object.bytes, input.contentType, input.visibility);
    return { etag: object.etag, url: input.visibility === 'PUBLIC' ? `https://${this.config().publicHost}/${input.targetKey}` : null };
  }
  async remove(key: string, area: StorageArea) { this.objects.delete(`${area}:${key}`); }
  async stream(key: string, area: ObjectVisibility, range?: { start: number; end: number }) {
    const bytes = this.object(key, area).bytes;
    return Readable.from(range ? bytes.subarray(range.start, range.end + 1) : bytes);
  }
}
