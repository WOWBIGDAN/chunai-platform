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
import { ContentImageDto } from './content.dto';

interface GrantClaims { sub: string; chapter: boolean; mediaId: string; audienceKind: 'guest' | 'user' | 'admin'; actorId?: string; sid?: string }
export const contentMediaDirectory = () => resolve(process.env.CONTENT_MEDIA_DIR ?? '.data/content-media');
const maxVideoBytes = 100 * 1024 * 1024;
const invalidGrant = () => new ApiException(401, 'PLAYBACK_GRANT_INVALID', '播放授权无效或已过期');

@Injectable()
export class ContentMediaService {
  constructor(private readonly db: DataSource, private readonly tx: CommerceTransaction, private readonly content: ContentService, private readonly jwt: JwtService) {}
  image(actor: Actor, dto: ContentImageDto) {
    return this.tx.run(actor, async m => {
      const url = new URL(dto.publicUrl);
      if (url.username || url.password) throw new ApiException(400, 'VALIDATION_ERROR', '图片地址不能包含凭据');
      const v = m.create(ContentMedia, { id: randomUUID(), ...dto, kind: 'IMAGE', storageKey: null, durationSeconds: 0, operatorId: actorId(actor) });
      await m.save(v); await this.tx.audit(m, actor, 'content-media.image', v.id); return this.content.mediaView(v);
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
        const v = m.create(ContentMedia, { id, kind: 'VIDEO', purpose: 'CONTENT_VIDEO', publicUrl: null, storageKey: key,
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
      const claims: GrantClaims = { sub: id, chapter, mediaId: media.id, audienceKind: admin ? 'admin' : principal ? 'user' : 'guest',
        ...(admin ? { actorId: actorId(admin), sid: admin.principal.sessionId } : principal ? { actorId: principal.user.id, sid: principal.sessionId } : {}) };
      const config = authConfig();
      const token = await this.jwt.signAsync(claims, { secret: config.secret, algorithm: 'HS256', audience: 'content-playback', issuer: config.issuer, expiresIn: 300 });
      const base = (process.env.PUBLIC_API_URL ?? 'http://localhost:3000/api/v1').replace(/\/$/, '');
      if (!/^https?:\/\//.test(base)) throw new Error('PUBLIC_API_URL must be an absolute API URL');
      if (admin) await this.tx.audit(m, admin, 'content.admin-playback', id);
      return { contentId: c.id, chapterId: ch?.id ?? null, playbackUrl: `${base}/content-playback/${media.id}?token=${encodeURIComponent(token)}`,
        expiresAt: new Date(Date.now() + 300000), durationSeconds: media.durationSeconds, preview: access.reason === 'PREVIEW' };
    };
    return admin ? this.tx.run(admin, work) : this.db.transaction('REPEATABLE READ', work);
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
      if (!v?.storageKey || !/^[a-f0-9-]{36}\.mp4$/.test(v.storageKey)) throw missing(); return v;
    });
    const path = resolve(contentMediaDirectory(), media.storageKey!);
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) throw new ApiException(503, 'MEDIA_STORAGE_UNAVAILABLE', '视频文件暂不可用');
    let start = 0, end = info.size - 1;
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!match || (!match[1] && !match[2])) { res.setHeader('Content-Range', `bytes */${info.size}`); throw new ApiException(416, 'RANGE_INVALID', '不支持的分段范围'); }
      if (!match[1]) { start = Math.max(0, info.size - Number(match[2])); }
      else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= info.size) {
        res.setHeader('Content-Range', `bytes */${info.size}`); throw new ApiException(416, 'RANGE_INVALID', '分段超出文件范围');
      }
      res.status(206).setHeader('Content-Range', `bytes ${start}-${end}/${info.size}`);
    }
    res.setHeader('Content-Type', 'video/mp4'); res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', end - start + 1); res.setHeader('Cache-Control', 'private, no-store');
    await pipeline(createReadStream(path, { start, end }), res).catch(() => { res.destroy(); });
  }
}
