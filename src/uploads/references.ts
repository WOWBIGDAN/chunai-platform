import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';
import { ApiException } from '../common/http';
import { Actor, actorId, conflict, missing } from '../commerce/transaction';
import { AfterSaleEvidence, UploadMedia, uploadView } from './entities';

/** Managed object URLs have one canonical spelling so reference checks cannot be bypassed with aliases. */
export function managedPublicUrl(value?: string | null): string | null {
  if (!value) return null;
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  const host = process.env.CONTENT_IMAGE_OSS_HOST ??
    `${process.env.UPLOAD_OSS_PUBLIC_BUCKET ?? 'chunai-photo'}.oss-${process.env.UPLOAD_OSS_REGION ?? 'cn-hangzhou'}.aliyuncs.com`;
  if (url.hostname !== host) return null;
  let path: string;
  try { path = decodeURIComponent(url.pathname); }
  catch { throw missing(); }
  if (!path.startsWith('/uploads/')) return null;
  const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
  const managedPath = new RegExp(`^/uploads/public/${uuid}\\.(jpg|jpeg|png|webp|gif|mp4)$`);
  const canonical = `https://${host}${path}`;
  if (!managedPath.test(path) || value !== canonical) throw missing();
  return canonical;
}

/** Business writers take this lock after locking the business parent. Deletion takes only media locks. */
export async function lockManagedReference(m: EntityManager, id: string, purpose: string, publicUrl?: string): Promise<void> {
  const managedUrl = managedPublicUrl(publicUrl);
  const rows = await m.getRepository(UploadMedia).createQueryBuilder('v')
    .where('v.id = :id', { id }).orWhere(publicUrl ? 'v.publicUrl = :url' : '1 = 0', { url: publicUrl })
    .orderBy('v.id', 'ASC').setLock('pessimistic_write').getMany();
  if (managedUrl && !rows.some(row => row.publicUrl === managedUrl)) throw missing();
  for (const row of rows) if (row.status !== 'READY' || row.purpose !== purpose) conflict('MEDIA_UNAVAILABLE', '素材尚未就绪或用途不匹配');
}

export async function resolveAvatar(m: EntityManager, actor: Actor, input: { avatarMediaId?: string | null; avatarUrl?: string | null }) {
  if (input.avatarMediaId !== undefined && input.avatarUrl !== undefined) throw new ApiException(400, 'VALIDATION_ERROR', '头像 ID 与地址只能提供一项');
  if (input.avatarMediaId === undefined && input.avatarUrl === undefined) return undefined;
  if (input.avatarMediaId === null || input.avatarUrl === null) return { avatarMediaId: null, avatarUrl: null };
  const managedUrl = managedPublicUrl(input.avatarUrl);
  const query = m.getRepository(UploadMedia).createQueryBuilder('v');
  if (input.avatarMediaId) query.where('v.id = :id', { id: input.avatarMediaId });
  else query.where('v.publicUrl = :url', { url: input.avatarUrl });
  const row = await query.setLock('pessimistic_write').getOne();
  if (!row) {
    if (input.avatarMediaId || managedUrl) throw missing();
    return { avatarMediaId: null, avatarUrl: input.avatarUrl! };
  }
  if (actor.kind !== 'user' || row.ownerKind !== 'USER' || row.ownerId !== actorId(actor)) throw missing();
  if (row.purpose !== 'AVATAR' || row.status !== 'READY' || row.visibility !== 'PUBLIC' || !row.publicUrl) conflict('MEDIA_UNAVAILABLE', '头像尚未就绪或用途不匹配');
  return { avatarMediaId: row.id, avatarUrl: row.publicUrl };
}

export async function bindAfterSaleEvidence(m: EntityManager, actor: Actor, afterSaleId: string, userId: string, ids: string[] = []) {
  if (ids.length > 9 || new Set(ids).size !== ids.length) throw new ApiException(400, 'VALIDATION_ERROR', '售后凭证最多九张且不能重复');
  if (!ids.length) return;
  if (actor.kind !== 'user' || actorId(actor) !== userId) throw missing();
  for (const id of [...ids].sort()) {
    const row = await m.findOne(UploadMedia, { where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!row || row.ownerKind !== 'USER' || row.ownerId !== userId) throw missing();
    if (row.status !== 'READY' || row.purpose !== 'AFTERSALE_EVIDENCE' || row.visibility !== 'PRIVATE') conflict('MEDIA_UNAVAILABLE', '售后凭证尚未就绪或用途不匹配');
    if (await m.existsBy(AfterSaleEvidence, { mediaId: id })) conflict('MEDIA_IN_USE', '凭证已关联售后，请重新上传');
  }
  await m.save(ids.map((mediaId, sortOrder) => m.create(AfterSaleEvidence, { id: randomUUID(), mediaId, afterSaleId, sortOrder })));
}
export async function afterSaleEvidence(m: EntityManager, afterSaleId: string) {
  const links = await m.find(AfterSaleEvidence, { where: { afterSaleId }, order: { sortOrder: 'ASC' } });
  return Promise.all(links.map(async link => uploadView(await m.findOneByOrFail(UploadMedia, { id: link.mediaId }))));
}

export async function hasMediaReferences(m: EntityManager, v: UploadMedia): Promise<boolean> {
  // Read committed after acquiring the media lock sees any completed business binding.
  const checks: [string, unknown[]][] = [
    ['SELECT 1 FROM users WHERE avatar_media_id = ? OR avatar_url = ? LIMIT 1', [v.id, v.publicUrl]],
    ['SELECT 1 FROM after_sale_evidence WHERE media_id = ? LIMIT 1', [v.id]],
    ['SELECT 1 FROM products WHERE cover_media_id = ? OR JSON_CONTAINS(gallery_media_ids, JSON_QUOTE(?)) LIMIT 1', [v.id, v.id]],
    ['SELECT 1 FROM contents WHERE cover_media_id = ? OR video_media_id = ? OR JSON_CONTAINS(image_media_ids, JSON_QUOTE(?)) LIMIT 1', [v.id, v.id, v.id]],
    ['SELECT 1 FROM content_columns WHERE cover_media_id = ? LIMIT 1', [v.id]],
    ['SELECT 1 FROM course_chapters WHERE video_media_id = ? OR JSON_CONTAINS(image_media_ids, JSON_QUOTE(?)) LIMIT 1', [v.id, v.id]],
  ];
  if (v.publicUrl) checks.push(
    ['SELECT 1 FROM order_items WHERE cover_url = ? LIMIT 1', [v.publicUrl]],
    ["SELECT 1 FROM order_quotes WHERE expires_at > UTC_TIMESTAMP(3) AND JSON_SEARCH(items, 'one', ?, NULL, '$[*].coverUrl') IS NOT NULL LIMIT 1", [v.publicUrl]],
    ['SELECT 1 FROM content_media WHERE public_url = ? AND id <> ? LIMIT 1', [v.publicUrl, v.id]],
    ['SELECT 1 FROM product_images WHERE public_url = ? AND id <> ? LIMIT 1', [v.publicUrl, v.id]],
  );
  for (const [sql, params] of checks) if ((await m.query(sql, params)).length) return true;
  return false;
}
