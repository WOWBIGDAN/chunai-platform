import 'reflect-metadata';
import { EntityManager } from 'typeorm';
import { ApiException } from '../../src/common/http';
import { Actor } from '../../src/commerce/transaction';
import { UploadMedia } from '../../src/uploads/entities';
import { lockManagedReference, managedPublicUrl, resolveAvatar } from '../../src/uploads/references';

const id = 'c7ead7b4-aef6-48b7-8c30-b9b6685750e7';
const ownerId = '01234567-89ab-4cde-8fab-0123456789ab';
const host = 'chunai-photo.oss-cn-hangzhou.aliyuncs.com';
const url = `https://${host}/uploads/public/${id}.png`;
const actor = { kind: 'user', principal: { user: { id: ownerId }, sessionId: 'cs-session' } } as Actor;
function fixture(rows: Partial<UploadMedia>[]) {
  const builder = { where: jest.fn().mockReturnThis(), orWhere: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue(rows), getOne: jest.fn().mockResolvedValue(rows[0] ?? null) };
  const manager = { getRepository: () => ({ createQueryBuilder: () => builder }) } as unknown as EntityManager;
  return { manager, builder };
}
const saved = Object.fromEntries(['CONTENT_IMAGE_OSS_HOST', 'UPLOAD_OSS_PUBLIC_BUCKET', 'UPLOAD_OSS_REGION'].map(key => [key, process.env[key]]));
describe('managed upload references', () => {
  beforeEach(() => { process.env.CONTENT_IMAGE_OSS_HOST = host; });
  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });

  it.each([
    `${url}?x-oss-process=image/resize,w_100`, `${url}#fragment`, url.replace('/public/', '/%70ublic/'),
    url.replace('/uploads/', '/%75ploads/'), url.replace('/uploads/public/', '/uploads%2fpublic/'),
    url.replace('/uploads/public/', '/uploads/unused/../public/'), url.replace('https://', 'http://'),
    url.replace(host, `${host}:443`), url.replace('/public/', '/private/'), url.replace('/public/', '/staging/'),
  ])('rejects aliases before they can bypass ownership, state and deletion protection: %s', async alias => {
    const { manager, builder } = fixture([]);
    await expect(lockManagedReference(manager, id, 'CONTENT_BODY_IMAGE', alias)).rejects.toBeInstanceOf(ApiException);
    await expect(resolveAvatar(manager, actor, { avatarUrl: alias })).rejects.toBeInstanceOf(ApiException);
    expect(builder.getMany).not.toHaveBeenCalled(); expect(builder.getOne).not.toHaveBeenCalled();
  });

  it('rejects a canonical but unknown managed object instead of treating it as an external image', async () => {
    const { manager } = fixture([]);
    expect(managedPublicUrl(url)).toBe(url);
    await expect(lockManagedReference(manager, id, 'CONTENT_BODY_IMAGE', url)).rejects.toMatchObject({ status: 404 });
    await expect(resolveAvatar(manager, actor, { avatarUrl: url })).rejects.toMatchObject({ status: 404 });
  });

  it('keeps legacy images outside this OSS managed namespace compatible', async () => {
    const { manager } = fixture([]);
    for (const legacy of [`https://${host}/covers/old.png?x-oss-process=image/resize,w_100`,
      `https://another.example/uploads/public/${id}.png`, `https://another-bucket.oss-cn-hangzhou.aliyuncs.com/uploads/public/${id}.png`]) {
      expect(managedPublicUrl(legacy)).toBeNull();
      await expect(lockManagedReference(manager, id, 'CONTENT_BODY_IMAGE', legacy)).resolves.toBeUndefined();
    }
  });

  it('binds canonical avatars to their live owner and rejects deleted or foreign uploads', async () => {
    const row = { id, ownerId, ownerKind: 'USER', purpose: 'AVATAR', status: 'READY', visibility: 'PUBLIC', publicUrl: url } as const;
    const { manager, builder } = fixture([row]);
    await expect(resolveAvatar(manager, actor, { avatarUrl: url })).resolves.toEqual({ avatarMediaId: id, avatarUrl: url });
    expect(builder.setLock).toHaveBeenCalledWith('pessimistic_write');
    await expect(resolveAvatar(fixture([{ ...row, ownerId: 'another-user' }]).manager, actor, { avatarUrl: url })).rejects.toMatchObject({ status: 404 });
    await expect(resolveAvatar(fixture([{ ...row, status: 'DELETED' }]).manager, actor, { avatarUrl: url })).rejects.toMatchObject({ status: 409 });
  });

  it('validates purpose and state even when a canonical URL is registered under a new legacy media ID', async () => {
    const { manager } = fixture([{ id, publicUrl: url, purpose: 'AVATAR', status: 'READY' }]);
    await expect(lockManagedReference(manager, ownerId, 'CONTENT_BODY_IMAGE', url)).rejects.toMatchObject({ status: 409 });
    await expect(lockManagedReference(fixture([{ id, publicUrl: url, purpose: 'CONTENT_BODY_IMAGE', status: 'DELETED' }]).manager,
      ownerId, 'CONTENT_BODY_IMAGE', url)).rejects.toMatchObject({ status: 409 });
    await expect(lockManagedReference(fixture([{ id, publicUrl: url, purpose: 'CONTENT_BODY_IMAGE', status: 'READY' }]).manager,
      ownerId, 'CONTENT_BODY_IMAGE', url)).resolves.toBeUndefined();
  });
});
