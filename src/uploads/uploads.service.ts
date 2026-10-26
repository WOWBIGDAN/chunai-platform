import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Response } from 'express';
import { DataSource, EntityManager } from 'typeorm';
import { ApiException, Principal } from '../common/http';
import { authConfig } from '../config';
import { AdminPrincipal } from '../commerce/admin-auth';
import { AdminAccount, AdminSession, ProductImage } from '../commerce/entities';
import { Permission } from '../commerce/permissions';
import { Actor, actorId, CommerceTransaction, conflict, missing } from '../commerce/transaction';
import { AuthSession, User } from '../database/entities';
import { ContentMedia } from '../content/entities';
import { AfterSaleEvidence, UploadMedia, UploadPurpose, uploadView } from './entities';
import { OssStorage } from './oss-storage';
import { hasMediaReferences } from './references';
import { UploadCreateDto } from './uploads.dto';

export type UploadPrincipal = { kind: 'user'; principal: Principal } | { kind: 'admin'; principal: AdminPrincipal };
const extension: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4' };
const userPurposes = ['AVATAR', 'AFTERSALE_EVIDENCE'];
const actor = (who: UploadPrincipal, permission: Permission = 'media:write'): Actor => who.kind === 'user' ? who : { ...who, permission };
const owned = (v: UploadMedia, a: UploadPrincipal) => v.ownerKind === (a.kind === 'user' ? 'USER' : 'ADMIN') && v.ownerId === actorId(actor(a));
const denied = () => new ApiException(403, 'PERMISSION_DENIED', '没有此素材操作权限');
const invalid = () => new ApiException(422, 'UPLOAD_OBJECT_INVALID', '上传文件大小、类型或文件头不符合要求');
const grantInvalid = () => new ApiException(401, 'MEDIA_GRANT_INVALID', '文件读取授权无效或已过期');
interface ReadClaims { sub: string; kind: 'user' | 'admin'; actorId: string; sid: string }

export function validateUploadHeader(header: Buffer, mime: string, size: number): void {
  const valid = mime === 'image/jpeg' ? size >= 4 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
    : mime === 'image/png' ? size >= 24 && header.length >= 24 && header.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) &&
      header.toString('ascii', 12, 16) === 'IHDR' && header.readUInt32BE(16) > 0 && header.readUInt32BE(20) > 0
    : mime === 'image/webp' ? size >= 16 && header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP'
    : mime === 'video/mp4' ? size >= 24 && header.toString('ascii', 4, 8) === 'ftyp' : false;
  if (!valid) throw invalid();
}

@Injectable()
export class UploadsService {
  constructor(private readonly db: DataSource, private readonly tx: CommerceTransaction, private readonly storage: OssStorage, private readonly jwt: JwtService) {}
  private query(m: EntityManager) {
    return m.getRepository(UploadMedia).createQueryBuilder('v').addSelect(['v.storageKey', 'v.stagingKey', 'v.etag']);
  }
  private async purposePermission(m: EntityManager, who: UploadPrincipal, purpose: UploadPurpose) {
    if (who.kind === 'user') { if (!userPurposes.includes(purpose)) throw denied(); return; }
    if (userPurposes.includes(purpose)) throw denied();
    const admin = await m.findOneByOrFail(AdminAccount, { id: who.principal.account.id });
    const business = purpose === 'PRODUCT_IMAGE' ? 'products:write' : 'content:write';
    if (!admin.permissions.includes('media:write') || !admin.permissions.includes(business)) throw denied();
  }
  private verifyConfiguration(v: UploadMedia) {
    const c = this.storage.config();
    if (c.region !== v.region || c.privateBucket !== v.stagingBucket ||
      (v.visibility === 'PUBLIC' ? c.publicBucket : c.privateBucket) !== v.finalBucket) throw new ApiException(503, 'STORAGE_UNAVAILABLE', '文件存储配置已变更');
  }
  private async manageable(m: EntityManager, who: UploadPrincipal, v: UploadMedia, ownerOnly = false) {
    if (ownerOnly || who.kind === 'user') { if (!owned(v, who)) throw missing(); }
    if (v.ownerKind !== 'ADMIN' && who.kind === 'admin') throw missing();
    await this.purposePermission(m, who, v.purpose);
  }
  private async readableEvidence(m: EntityManager, who: UploadPrincipal, v: UploadMedia) {
    if (v.purpose !== 'AFTERSALE_EVIDENCE' || v.visibility !== 'PRIVATE' || v.status !== 'READY') throw missing();
    if (who.kind === 'user') { if (!owned(v, who)) throw missing(); }
    else if (!await m.existsBy(AfterSaleEvidence, { mediaId: v.id })) throw missing();
  }

  create(who: UploadPrincipal, dto: UploadCreateDto) {
    const video = dto.purpose === 'CONTENT_VIDEO';
    if (video !== (dto.mimeType === 'video/mp4') || (!video && dto.durationSeconds !== undefined) || (!video && dto.sizeBytes > 10 * 1024 * 1024)) {
      throw new ApiException(400, 'VALIDATION_ERROR', '图片上限 10 MiB，视频上限 100 MiB；用途与文件类型必须匹配');
    }
    return this.tx.run(actor(who), async m => {
      await this.purposePermission(m, who, dto.purpose);
      if (!this.storage.support()) throw new ApiException(503, 'STORAGE_UNAVAILABLE', '文件存储服务尚未配置');
      const ownerKind = who.kind === 'user' ? 'USER' : 'ADMIN', ownerId = actorId(actor(who)), now = new Date();
      const count = m.getRepository(UploadMedia).createQueryBuilder('v').where('v.ownerKind = :ownerKind AND v.ownerId = :ownerId', { ownerKind, ownerId });
      if (await count.clone().andWhere("v.status = 'UPLOADING' AND v.expiresAt > :now", { now }).getCount() >= 20 ||
          await count.clone().andWhere('v.createdAt > :since', { since: new Date(Date.now() - 86400000) }).getCount() >= (who.kind === 'user' ? 100 : 500)) {
        throw new ApiException(429, 'UPLOAD_LIMIT_EXCEEDED', '上传额度已用完，请稍后重试');
      }
      const config = this.storage.config(), id = randomUUID(), ext = extension[dto.mimeType];
      const visibility = ['AFTERSALE_EVIDENCE', 'CONTENT_VIDEO'].includes(dto.purpose) ? 'PRIVATE' : 'PUBLIC';
      const v = m.create(UploadMedia, { id, ownerKind, ownerId, ...dto, durationSeconds: dto.durationSeconds ?? 0,
        kind: video ? 'VIDEO' : 'IMAGE', status: 'UPLOADING', visibility, publicUrl: null, region: config.region,
        stagingBucket: config.privateBucket, finalBucket: visibility === 'PUBLIC' ? config.publicBucket : config.privateBucket,
        stagingKey: `uploads/staging/${id}.${ext}`, storageKey: `uploads/${visibility.toLowerCase()}/${randomUUID()}.${ext}`,
        etag: null, expiresAt: new Date(Date.now() + 600000), completedAt: null, deletedAt: null, cleanedAt: null, stagingCleanedAt: null });
      const grant = await this.storage.createUploadGrant({ key: v.stagingKey, contentType: v.mimeType, sizeBytes: v.sizeBytes, expiresAt: v.expiresAt });
      await m.save(v); await this.tx.audit(m, actor(who), 'upload.create', id, { purpose: v.purpose, sizeBytes: v.sizeBytes });
      return { uploadId: id, mediaId: id, ...grant, expiresAt: v.expiresAt };
    });
  }

  async complete(who: UploadPrincipal, id: string) {
    const result = await this.tx.run(actor(who), async m => {
      const v = await this.query(m).where('v.id = :id', { id }).setLock('pessimistic_write').getOne();
      if (!v) throw missing(); await this.manageable(m, who, v, true);
      if (v.status === 'READY') return { value: uploadView(v) };
      if (v.status !== 'UPLOADING') conflict('UPLOAD_STATE_INVALID', '该上传已失效或已删除');
      if (v.expiresAt.getTime() <= Date.now()) { v.status = 'FAILED'; await m.save(v); return { error: new ApiException(409, 'UPLOAD_EXPIRED', '上传凭证已过期，请重新申请') }; }
      this.verifyConfiguration(v);
      try {
        const source = await this.storage.inspect(v.stagingKey);
        if (source.sizeBytes !== v.sizeBytes || source.contentType !== v.mimeType) throw invalid();
        validateUploadHeader(await this.storage.readPrefix(v.stagingKey, source.etag), v.mimeType, v.sizeBytes);
        try {
          await this.storage.promote({ sourceKey: v.stagingKey, targetKey: v.storageKey, etag: source.etag, contentType: v.mimeType, visibility: v.visibility });
        } catch (e) {
          // A prior attempt can copy successfully and lose its DB connection. The final key is server-only and immutable.
          if (!(e instanceof ApiException) || (e.getResponse() as { code?: string }).code !== 'UPLOAD_OBJECT_CHANGED') throw e;
          const target = await this.storage.inspect(v.storageKey, v.visibility);
          if (target.etag.replace(/"/g, '') !== source.etag.replace(/"/g, '') || target.sizeBytes !== v.sizeBytes || target.contentType !== v.mimeType) throw e;
        }
        v.etag = source.etag; v.status = 'READY'; v.completedAt = new Date();
        v.publicUrl = v.visibility === 'PUBLIC' ? `https://${this.storage.config().publicHost}/${v.storageKey}` : null;
        if (v.purpose === 'PRODUCT_IMAGE') await m.insert(ProductImage, { id, publicUrl: v.publicUrl!, mimeType: v.mimeType, sizeBytes: v.sizeBytes, operatorId: v.ownerId });
        else if (!userPurposes.includes(v.purpose)) await m.insert(ContentMedia, { id, kind: v.kind, provider: 'OSS', purpose: v.purpose as ContentMedia['purpose'],
          publicUrl: v.publicUrl, storageKey: null, mimeType: v.mimeType, sizeBytes: v.sizeBytes, durationSeconds: v.durationSeconds,
          externalUrlEncrypted: null, accessPasswordEncrypted: null, operatorId: v.ownerId });
        await m.save(v); await this.tx.audit(m, actor(who), 'upload.complete', id, { purpose: v.purpose });
        return { value: uploadView(v) };
      } catch (e) {
        if (e instanceof ApiException && e.getStatus() === 422) { v.status = 'FAILED'; await m.save(v); return { error: e }; }
        throw e;
      }
    });
    if (result.error) throw result.error; return result.value!;
  }
  async get(who: UploadPrincipal, id: string) {
    const candidate = await this.db.getRepository(UploadMedia).findOneBy({ id }); if (!candidate) throw missing();
    const evidenceAdmin = who.kind === 'admin' && candidate.purpose === 'AFTERSALE_EVIDENCE';
    return this.tx.run(actor(who, evidenceAdmin ? 'aftersales:review' : 'media:write'), async m => {
      const v = await m.findOneBy(UploadMedia, { id }); if (!v) throw missing();
      if (evidenceAdmin) { await this.readableEvidence(m, who, v); await this.tx.audit(m, actor(who, 'aftersales:review'), 'media.evidence-metadata', id); }
      else await this.manageable(m, who, v);
      return uploadView(v);
    });
  }
  remove(who: UploadPrincipal, id: string) {
    return this.tx.run(actor(who), async m => {
      const v = await m.findOne(UploadMedia, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!v) throw missing(); await this.manageable(m, who, v, true);
      if (v.status === 'DELETED') return { success: true };
      if (await hasMediaReferences(m, v)) conflict('MEDIA_IN_USE', '素材已被业务记录引用，不能删除');
      v.status = 'DELETED'; v.deletedAt = new Date(); await m.save(v);
      await this.tx.audit(m, actor(who), 'media.delete', id); return { success: true };
    });
  }
  readGrant(who: UploadPrincipal, id: string) {
    return this.tx.run(actor(who, 'aftersales:review'), async m => {
      const v = await m.findOneBy(UploadMedia, { id }); if (!v) throw missing(); await this.readableEvidence(m, who, v);
      this.verifyConfiguration(v);
      const c = authConfig(), expiresAt = new Date(Date.now() + 60000);
      const token = await this.jwt.signAsync({ sub: id, kind: who.kind, actorId: actorId(actor(who)), sid: who.principal.sessionId },
        { secret: c.secret, algorithm: 'HS256', audience: 'media-read', issuer: c.issuer, expiresIn: 60 });
      if (who.kind === 'admin') await this.tx.audit(m, actor(who, 'aftersales:review'), 'media.evidence-read', id);
      const base = (process.env.PUBLIC_API_URL ?? 'http://localhost:3000/api/v1').replace(/\/$/, '');
      return { mediaId: id, url: `${base}/media/${id}/file?token=${encodeURIComponent(token)}`, expiresAt };
    });
  }
  async file(id: string, token: string, res: Response) {
    let claims: ReadClaims;
    try { const c = authConfig(); claims = await this.jwt.verifyAsync(token, { secret: c.secret, algorithms: ['HS256'], audience: 'media-read', issuer: c.issuer }); }
    catch { throw grantInvalid(); }
    if (claims.sub !== id || !['user', 'admin'].includes(claims.kind) || typeof claims.actorId !== 'string' || typeof claims.sid !== 'string') throw grantInvalid();
    const v = await this.db.transaction('READ COMMITTED', async m => {
      let who: UploadPrincipal;
      if (claims.kind === 'user') {
        const user = await m.findOneBy(User, { id: claims.actorId, status: 'ACTIVE' }); const session = await m.findOneBy(AuthSession, { id: claims.sid, userId: claims.actorId });
        if (!user || !session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) throw grantInvalid();
        who = { kind: 'user', principal: { user, sessionId: session.id } };
      } else {
        const account = await m.findOneBy(AdminAccount, { id: claims.actorId, enabled: true }); const session = await m.findOneBy(AdminSession, { id: claims.sid, adminId: claims.actorId });
        if (!account?.permissions.includes('aftersales:review') || !session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) throw grantInvalid();
        who = { kind: 'admin', principal: { account, sessionId: session.id } };
      }
      const media = await this.query(m).where('v.id = :id', { id }).getOne(); if (!media) throw missing(); await this.readableEvidence(m, who, media); return media;
    });
    this.verifyConfiguration(v); const source = await this.storage.stream(v.storageKey, 'PRIVATE');
    res.setHeader('Content-Type', v.mimeType); res.setHeader('Content-Length', v.sizeBytes); res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', 'inline'); res.setHeader('X-Content-Type-Options', 'nosniff');
    await pipeline(source, res).catch(() => res.destroy());
  }

  /** Delaying cleanup until grants expire prevents an old upload ticket recreating a deleted staging object. */
  async cleanup(id: string) {
    await this.db.transaction('READ COMMITTED', async m => {
      const v = await this.query(m).where('v.id = :id', { id }).setLock('pessimistic_write').getOne();
      if (!v || v.expiresAt.getTime() + 60000 >= Date.now()) return;
      if (v.status === 'UPLOADING') { v.status = 'FAILED'; await m.save(v); }
      this.verifyConfiguration(v);
      if (!v.stagingCleanedAt) { await this.storage.remove(v.stagingKey, 'STAGING'); v.stagingCleanedAt = new Date(); }
      if (['FAILED', 'DELETED'].includes(v.status) && !v.cleanedAt) {
        await this.storage.remove(v.storageKey, v.visibility); v.cleanedAt = new Date();
      }
      await m.save(v);
    });
  }
}
