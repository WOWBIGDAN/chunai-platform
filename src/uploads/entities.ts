import { Column, Entity, Index } from 'typeorm';
import { RecordBase } from '../commerce/entities';

export const UPLOAD_PURPOSES = ['AVATAR', 'AFTERSALE_EVIDENCE', 'CONTENT_COVER', 'COLUMN_COVER', 'CONTENT_BODY_IMAGE', 'PRODUCT_IMAGE', 'CONTENT_VIDEO'] as const;
export type UploadPurpose = typeof UPLOAD_PURPOSES[number];
@Entity('upload_media')
@Index('idx_upload_owner', ['ownerKind', 'ownerId', 'createdAt'])
export class UploadMedia extends RecordBase {
  @Column({ name: 'owner_kind', type: 'varchar', length: 8 }) ownerKind!: 'USER' | 'ADMIN';
  @Column({ name: 'owner_id', type: 'varchar', length: 36 }) ownerId!: string;
  @Column({ type: 'varchar', length: 32 }) purpose!: UploadPurpose;
  @Column({ type: 'varchar', length: 8 }) kind!: 'IMAGE' | 'VIDEO';
  @Column({ type: 'varchar', length: 16 }) status!: 'UPLOADING' | 'READY' | 'FAILED' | 'DELETED';
  @Column({ name: 'file_name', type: 'varchar', length: 200 }) fileName!: string;
  @Column({ name: 'mime_type', type: 'varchar', length: 32 }) mimeType!: string;
  @Column({ name: 'size_bytes', type: 'int', unsigned: true }) sizeBytes!: number;
  @Column({ name: 'duration_seconds', type: 'int', unsigned: true, default: 0 }) durationSeconds!: number;
  @Column({ type: 'varchar', length: 8 }) visibility!: 'PUBLIC' | 'PRIVATE';
  @Column({ name: 'public_url', type: 'varchar', length: 2048, nullable: true }) publicUrl!: string | null;
  @Column({ type: 'varchar', length: 40 }) region!: string;
  @Column({ name: 'staging_bucket', type: 'varchar', length: 63 }) stagingBucket!: string;
  @Column({ name: 'final_bucket', type: 'varchar', length: 63 }) finalBucket!: string;
  @Column({ name: 'staging_key', type: 'varchar', length: 128, select: false }) stagingKey!: string;
  @Column({ name: 'storage_key', type: 'varchar', length: 128, select: false }) storageKey!: string;
  @Column({ type: 'varchar', length: 128, nullable: true, select: false }) etag!: string | null;
  @Column({ name: 'expires_at', type: 'datetime', precision: 3 }) expiresAt!: Date;
  @Column({ name: 'completed_at', type: 'datetime', precision: 3, nullable: true }) completedAt!: Date | null;
  @Column({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true }) deletedAt!: Date | null;
  @Column({ name: 'cleaned_at', type: 'datetime', precision: 3, nullable: true }) cleanedAt!: Date | null;
  @Column({ name: 'staging_cleaned_at', type: 'datetime', precision: 3, nullable: true }) stagingCleanedAt!: Date | null;
}
@Entity('after_sale_evidence')
@Index('uq_after_sale_evidence_media', ['mediaId'], { unique: true })
export class AfterSaleEvidence extends RecordBase {
  @Column({ name: 'after_sale_id', type: 'varchar', length: 36 }) afterSaleId!: string;
  @Column({ name: 'media_id', type: 'varchar', length: 36 }) mediaId!: string;
  @Column({ name: 'sort_order', type: 'int', unsigned: true }) sortOrder!: number;
}
export const uploadEntities = [UploadMedia, AfterSaleEvidence];
export function uploadView(v: UploadMedia) {
  return { id: v.id, kind: v.kind, provider: 'OSS', status: v.status, mimeType: v.mimeType,
    sizeBytes: v.sizeBytes, publicUrl: v.status === 'READY' && v.visibility === 'PUBLIC' ? v.publicUrl : null };
}
