import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, rename, stat, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Response } from 'express';
import { DataSource, EntityManager } from 'typeorm';
import { authConfig } from '../config';
import { ApiException, ApiRequest, Principal } from '../common/http';
import { AdminAccount, AdminSession } from '../commerce/entities';
import { AuthSession, User } from '../database/entities';
import { Actor, actorId, CommerceTransaction, missing } from '../commerce/transaction';
import { ContentMedia } from './entities';
import { ContentService } from './content.service';
import { ContentImageDto, ExternalVideoDto } from './content.dto';
import { decryptMediaSecret, encryptMediaSecret, validateContentImageUrl, validateExternalVideoUrl } from './media-source';
import { UploadMedia } from '../uploads/entities';
import { lockManagedReference } from '../uploads/references';
import { OssStorage } from '../uploads/oss-storage';

interface GrantClaims { sub: string; chapter: boolean; mediaId: string; audienceKind: 'guest' | 'user' | 'admin'; actorId?: string; sid?: string }
export const contentMediaDirectory = () => resolve(process.env.CONTENT_MEDIA_DIR ?? '.data/content-media');
const maxVideoBytes = 100 * 1024 * 1024;
const invalidGrant = () => new ApiException(401, 'PLAYBACK_GRANT_INVALID', '播放授权无效或已过期');

@Injectable()
export class ContentMediaService {
  constructor(private readonly db: DataSource, private readonly tx: CommerceTransaction, private readonly content: ContentService,
    private readonly jwt: JwtService, private readonly storage: OssStorage) {}
  image(actor: Actor, dto: ContentImageDto) {
    return this.tx.run(actor, async m => {
      const source = validateContentImageUrl(dto.publicUrl, dto.purpose !== 'CONTENT_BODY_IMAGE');
      const v = m.create(ContentMedia, { id: randomUUID(), ...dto, ...source, kind: 'IMAGE', storageKey: null,
        externalUrlEncrypted: null, accessPasswordEncrypted: null, durationSeconds: 0, operatorId: actorId(actor) });
      await lockManagedReference(m, v.id, v.purpose, v.publicUrl ?? undefined);
      await m.save(v); await this.tx.audit(m, actor, 'content-media.image', v.id); return this.content.mediaView(v);
    });
  }
  externalVideo(actor: Actor, dto: ExternalVideoDto) {
    return this.tx.run(actor, async m => {
      const externalUrl = validateExternalVideoUrl(dto.provider, dto.externalUrl);
      if (dto.provider === 'FEISHU' && (!dto.accessPassword?.trim() || /[\u0000-\u001f\u007f]/.test(dto.accessPassword)))
        throw new ApiException(400, 'VALIDATION_ERROR', '加密飞书视频必须提供有效的访问密码');
      if (dto.provider === 'BILIBILI' && dto.accessPassword !== undefined)
        throw new ApiException(400, 'VALIDATION_ERROR', 'B 站视频不支持访问密码');
      const id = randomUUID();
      const v = m.create(ContentMedia, { id, kind: 'VIDEO', purpose: 'CONTENT_VIDEO', provider: dto.provider,
        publicUrl: null, storageKey: null, mimeType: 'text/uri-list', sizeBytes: 0, durationSeconds: dto.durationSeconds,
        externalUrlEncrypted: encryptMediaSecret(externalUrl, id, 'externalUrl'),
        accessPasswordEncrypted: dto.provider === 'FEISHU' ? encryptMediaSecret(dto.accessPassword!, id, 'accessPassword') : null,
        operatorId: actorId(actor) });
      await m.save(v);
      await this.tx.audit(m, actor, 'content-media.external-video', id, { provider: dto.provider });
      return this.content.mediaView(v);
    });
  }
  async upload(actor: Actor, req: ApiRequest, durationSeconds: number) {
    if (req.headers['content-type'] !== 'video/mp4') throw new ApiException(415, 'MEDIA_TYPE_UNSUPPORTED', '请以 video/mp4 上传原始 MP4 文件');
    if (Number(req.headers['content-length'] ?? 0) > maxVideoBytes) throw new ApiException(413, 'PAYLOAD_TOO_LARGE', '视频上限为 100 MiB');
    const id = randomUUID(), key = `${id}.mp4`, path = resolve(contentMediaDirectory(), key), temp = `${path}.part`;
    await mkdir(contentMediaDirectory(), { recursive: true }); let size = 0;
    try {
      const limiter = new Transform({ transform(chunk: Buffer, _encoding, callback) {
        size += chunk.length;
        callback(size > maxVideoBytes ? new ApiException(413, 'PAYLOAD_TOO_LARGE', '视频上限为 100 MiB') : null, chunk);
      } });
      await pipeline(req, limiter, createWriteStream(temp, { flags: 'wx', mode: 0o640 }));
      const handle = await open(temp, 'r'); const header = Buffer.alloc(12);
      try { await handle.read(header, 0, 12, 0); } finally { await handle.close(); }
      if (size < 24 || header.toString('ascii', 4, 8) !== 'ftyp') throw new ApiException(400, 'MEDIA_INVALID', '文件不是 MP4 容器');
      await rename(temp, path);
      return await this.tx.run(actor, async m => {
        const v = m.create(ContentMedia, { id, kind: 'VIDEO', purpose: 'CONTENT_VIDEO', provider: 'LOCAL', publicUrl: null, storageKey: key,
          externalUrlEncrypted: null, accessPasswordEncrypted: null,
          mimeType: 'video/mp4', sizeBytes: size, durationSeconds, operatorId: actorId(actor) });
        await m.save(v); await this.tx.audit(m, actor, 'content-media.video', id, { sizeBytes: size }); return this.content.mediaView(v);
      });
    } catch (e) { await unlink(temp).catch(() => {}); await unlink(path).catch(() => {}); throw e; }
  }
  async grant(id: string, chapter: boolean, principal?: Principal, admin?: Actor) {
    const work = async (m: EntityManager) => {
      const { c, ch, record, access } = await this.content.readable(m, id, chapter, true, principal, !!admin);
      if (!record.videoMediaId) throw missing();
      const media = await this.content.media(m, record.videoMediaId, 'CONTENT_VIDEO');
      if (media.provider === 'BILIBILI' || media.provider === 'FEISHU') {
        if (!admin) await this.content.assertExternalAccess(m, c, ch, principal, media.provider);
        // Select encrypted fields only after authorization. Never expose them in summaries or audits.
        const source = await m.getRepository(ContentMedia).createQueryBuilder('v')
          .addSelect(['v.externalUrlEncrypted', 'v.accessPasswordEncrypted']).where('v.id = :id', { id: media.id }).getOne();
        if (!source?.externalUrlEncrypted || (media.provider === 'FEISHU' && !source.accessPasswordEncrypted))
          throw new ApiException(503, 'MEDIA_SOURCE_UNAVAILABLE', '视频外链配置暂不可用');
        const externalUrl = decryptMediaSecret(source.externalUrlEncrypted, media.id, 'externalUrl');
        const accessPassword = media.provider === 'FEISHU' ? decryptMediaSecret(source.accessPasswordEncrypted!, media.id, 'accessPassword') : null;
        if (admin) await this.tx.audit(m, admin, 'content.admin-playback', id, { provider: media.provider });
        return { provider: media.provider, mode: 'EXTERNAL_LINK' as const, contentId: c.id, chapterId: ch?.id ?? null,
          playbackUrl: null, externalUrl, accessPassword, expiresAt: null, durationSeconds: media.durationSeconds,
          preview: access.reason === 'PREVIEW' };
      }
      if (!['LOCAL', 'OSS'].includes(media.provider)) throw missing();
      if (media.provider === 'OSS') await this.uploadedVideo(m, media.id);
      const claims: GrantClaims = { sub: id, chapter, mediaId: media.id, audienceKind: admin ? 'admin' : principal ? 'user' : 'guest',
        ...(admin ? { actorId: actorId(admin), sid: admin.principal.sessionId } : principal ? { actorId: principal.user.id, sid: principal.sessionId } : {}) };
      const config = authConfig();
      const token = await this.jwt.signAsync(claims, { secret: config.secret, algorithm: 'HS256', audience: 'content-playback', issuer: config.issuer, expiresIn: 300 });
      const base = (process.env.PUBLIC_API_URL ?? 'http://localhost:3000/api/v1').replace(/\/$/, '');
      if (!/^https?:\/\//.test(base)) throw new Error('PUBLIC_API_URL must be an absolute API URL');
      if (admin) await this.tx.audit(m, admin, 'content.admin-playback', id);
      return { provider: media.provider as 'LOCAL' | 'OSS', mode: 'STREAM' as const, contentId: c.id, chapterId: ch?.id ?? null,
        playbackUrl: `${base}/content-playback/${media.id}?token=${encodeURIComponent(token)}`, externalUrl: null, accessPassword: null,
        expiresAt: new Date(Date.now() + 300000), durationSeconds: media.durationSeconds, preview: access.reason === 'PREVIEW' };
    };
    return admin ? this.tx.run(admin, work) : this.db.transaction('REPEATABLE READ', work);
  }
  private async uploadedVideo(m: EntityManager, id: string) {
    const media = await m.getRepository(UploadMedia).createQueryBuilder('v').addSelect('v.storageKey')
      .where('v.id = :id AND v.kind = :kind AND v.purpose = :purpose AND v.status = :status AND v.visibility = :visibility',
        { id, kind: 'VIDEO', purpose: 'CONTENT_VIDEO', status: 'READY', visibility: 'PRIVATE' }).getOne();
    if (!media?.storageKey || media.mimeType !== 'video/mp4' || !Number.isSafeInteger(media.sizeBytes) || media.sizeBytes < 1) throw missing();
    const config = this.storage.config();
    if (media.region !== config.region || media.stagingBucket !== config.privateBucket || media.finalBucket !== config.privateBucket)
      throw new ApiException(503, 'MEDIA_STORAGE_UNAVAILABLE', '视频文件存储配置已变更');
    return media;
  }
  async stream(mediaId: string, token: string, req: ApiRequest, res: Response) {
    let claims: GrantClaims;
    try { const config = authConfig(); claims = await this.jwt.verifyAsync(token, { secret: config.secret, algorithms: ['HS256'], audience: 'content-playback', issuer: config.issuer }); }
    catch { throw invalidGrant(); }
    if (claims.mediaId !== mediaId || typeof claims.sub !== 'string' || typeof claims.chapter !== 'boolean' || !['guest', 'user', 'admin'].includes(claims.audienceKind)) throw invalidGrant();
    const media = await this.db.transaction('REPEATABLE READ', async m => {
      let principal: Principal | undefined;
      if (claims.audienceKind === 'admin') {
        if (!claims.actorId || !claims.sid) throw invalidGrant();
        const account = await m.findOneBy(AdminAccount, { id: claims.actorId, enabled: true });
        const session = await m.findOneBy(AdminSession, { id: claims.sid, adminId: claims.actorId });
        if (!account?.permissions.includes('content:write') || !session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) throw invalidGrant();
      } else if (claims.audienceKind === 'user') {
        if (!claims.actorId || !claims.sid) throw invalidGrant();
        const user = await m.findOneBy(User, { id: claims.actorId, status: 'ACTIVE' });
        const session = await m.findOneBy(AuthSession, { id: claims.sid, userId: claims.actorId });
        if (!user || !session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) throw invalidGrant();
        principal = { user, sessionId: session.id };
      }
      const { record } = await this.content.readable(m, claims.sub, claims.chapter, true, principal, claims.audienceKind === 'admin');
      if (record.videoMediaId !== mediaId) throw invalidGrant();
      const v = await m.getRepository(ContentMedia).createQueryBuilder('v').addSelect('v.storageKey').where('v.id = :mediaId', { mediaId }).getOne();
      if (v?.provider === 'OSS') return { media: v, upload: await this.uploadedVideo(m, v.id) };
      if (v?.provider !== 'LOCAL' || !v.storageKey || !/^[a-f0-9-]{36}\.mp4$/.test(v.storageKey)) throw missing();
      return { media: v, upload: null };
    });
    const path = media.upload ? null : resolve(contentMediaDirectory(), media.media.storageKey!);
    const info = path ? await stat(path).catch(() => null) : null;
    if (!media.upload && !info?.isFile()) throw new ApiException(503, 'MEDIA_STORAGE_UNAVAILABLE', '视频文件暂不可用');
    const size = media.upload?.sizeBytes ?? info!.size;
    let start = 0, end = size - 1;
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!match || (!match[1] && !match[2])) { res.setHeader('Content-Range', `bytes */${size}`); throw new ApiException(416, 'RANGE_INVALID', '不支持的分段范围'); }
      if (!match[1]) { start = Math.max(0, size - Number(match[2])); }
      else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) {
        res.setHeader('Content-Range', `bytes */${size}`); throw new ApiException(416, 'RANGE_INVALID', '分段超出文件范围');
      }
      res.status(206).setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    }
    // Resolve the upstream stream before writing response headers so storage errors keep the API envelope.
    const source = media.upload ? await this.storage.stream(media.upload.storageKey, 'PRIVATE', { start, end }) : createReadStream(path!, { start, end });
    res.setHeader('Content-Type', 'video/mp4'); res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', end - start + 1); res.setHeader('Cache-Control', 'private, no-store');
    await pipeline(source, res).catch(() => { res.destroy(); });
  }
}
