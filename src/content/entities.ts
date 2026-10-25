import { Column, Entity } from 'typeorm';
import { RecordBase, Versioned } from '../commerce/entities';

export const CONTENT_KINDS = ['SCIENCE_ARTICLE', 'SCIENCE_VIDEO', 'ARTICLE_COURSE', 'VIDEO_COURSE'] as const;
export type ContentKind = typeof CONTENT_KINDS[number];
export type PublishStatus = 'DRAFT' | 'PUBLISHED' | 'OFFLINE';
export const isCourse = (kind: ContentKind) => kind.endsWith('_COURSE');
export const isVideo = (kind: ContentKind) => kind === 'SCIENCE_VIDEO' || kind === 'VIDEO_COURSE';

@Entity('content_media')
export class ContentMedia extends RecordBase {
  @Column({ type: 'varchar', length: 16 }) kind!: 'IMAGE' | 'VIDEO';
  @Column({ type: 'varchar', length: 32 }) purpose!: 'CONTENT_COVER' | 'COLUMN_COVER' | 'CONTENT_BODY_IMAGE' | 'CONTENT_VIDEO';
  @Column({ name: 'public_url', type: 'varchar', length: 2048, nullable: true }) publicUrl!: string | null;
  @Column({ name: 'storage_key', type: 'varchar', length: 64, nullable: true, select: false }) storageKey!: string | null;
  @Column({ name: 'mime_type', type: 'varchar', length: 32 }) mimeType!: string;
  @Column({ name: 'size_bytes', type: 'int', unsigned: true }) sizeBytes!: number;
  @Column({ name: 'duration_seconds', type: 'int', unsigned: true, default: 0 }) durationSeconds!: number;
  @Column({ name: 'operator_id', type: 'varchar', length: 36 }) operatorId!: string;
}
export abstract class BodyRecord extends Versioned {
  @Column({ name: 'body_html', type: 'mediumtext', nullable: true }) bodyHtml!: string | null;
  @Column({ name: 'image_media_ids', type: 'json' }) imageMediaIds!: string[];
  @Column({ name: 'video_media_id', type: 'varchar', length: 36, nullable: true }) videoMediaId!: string | null;
  @Column({ type: 'varchar', length: 16, default: 'DRAFT' }) status!: PublishStatus;
  @Column({ name: 'published_at', type: 'datetime', precision: 3, nullable: true }) publishedAt!: Date | null;
}
@Entity('contents')
export class Content extends BodyRecord {
  @Column({ type: 'varchar', length: 24 }) kind!: ContentKind;
  @Column({ type: 'varchar', length: 120 }) title!: string;
  @Column({ type: 'varchar', length: 2000 }) summary!: string;
  @Column({ name: 'description_html', type: 'mediumtext' }) descriptionHtml!: string;
  @Column({ name: 'cover_media_id', type: 'varchar', length: 36 }) coverMediaId!: string;
  @Column({ name: 'category_id', type: 'varchar', length: 36 }) categoryId!: string;
  @Column({ name: 'author_name', type: 'varchar', length: 64 }) authorName!: string;
  @Column({ type: 'json' }) tags!: string[];
  @Column({ name: 'access_policy', type: 'varchar', length: 24 }) accessPolicy!: 'FREE' | 'PURCHASE';
  @Column({ name: 'price_cents', type: 'int', unsigned: true }) priceCents!: number;
}
@Entity('course_chapters')
export class Chapter extends BodyRecord {
  @Column({ name: 'course_id', type: 'varchar', length: 36 }) courseId!: string;
  @Column({ type: 'varchar', length: 120 }) title!: string;
  @Column({ type: 'varchar', length: 16 }) kind!: 'ARTICLE' | 'VIDEO';
  @Column({ name: 'sort_order', type: 'int', default: 0 }) sortOrder!: number;
  @Column({ name: 'is_preview', type: 'boolean', default: false }) isPreview!: boolean;
}
@Entity('content_columns')
export class ContentColumn extends Versioned {
  @Column({ type: 'varchar', length: 64 }) name!: string;
  @Column({ type: 'varchar', length: 2000 }) description!: string;
  @Column({ name: 'cover_media_id', type: 'varchar', length: 36 }) coverMediaId!: string;
  @Column({ name: 'sort_order', type: 'int', default: 0 }) sortOrder!: number;
  @Column({ type: 'varchar', length: 16, default: 'DRAFT' }) status!: PublishStatus;
}
@Entity('column_contents')
export class ColumnContent extends RecordBase {
  @Column({ name: 'column_id', type: 'varchar', length: 36 }) columnId!: string;
  @Column({ name: 'content_id', type: 'varchar', length: 36 }) contentId!: string;
  @Column({ name: 'sort_order', type: 'int', default: 0 }) sortOrder!: number;
}
@Entity('course_entitlements')
export class CourseEntitlement extends RecordBase {
  @Column({ name: 'user_id', type: 'varchar', length: 36 }) userId!: string;
  @Column({ name: 'course_id', type: 'varchar', length: 36 }) courseId!: string;
  @Column({ name: 'order_id', type: 'varchar', length: 36 }) orderId!: string;
  @Column({ type: 'varchar', length: 16 }) status!: 'ACTIVE' | 'REVOKED';
  @Column({ name: 'revoked_at', type: 'datetime', precision: 3, nullable: true }) revokedAt!: Date | null;
}
export const contentEntities = [ContentMedia, Content, Chapter, ContentColumn, ColumnContent, CourseEntitlement];
