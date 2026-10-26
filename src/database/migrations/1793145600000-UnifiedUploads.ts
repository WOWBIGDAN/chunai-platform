import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive and retryable: MySQL DDL may commit before a release is interrupted. */
export class UnifiedUploads1793145600000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS upload_media (
      id varchar(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
      created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
      updated_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
      owner_kind varchar(8) NOT NULL,
      owner_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      purpose varchar(32) NOT NULL,
      kind varchar(8) NOT NULL,
      status varchar(16) NOT NULL,
      file_name varchar(200) NOT NULL,
      mime_type varchar(32) NOT NULL,
      size_bytes int unsigned NOT NULL,
      duration_seconds int unsigned NOT NULL DEFAULT 0,
      visibility varchar(8) NOT NULL,
      public_url varchar(2048) NULL,
      region varchar(40) NOT NULL,
      staging_bucket varchar(63) NOT NULL,
      final_bucket varchar(63) NOT NULL,
      staging_key varchar(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      storage_key varchar(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      etag varchar(128) NULL,
      expires_at datetime(3) NOT NULL,
      completed_at datetime(3) NULL,
      deleted_at datetime(3) NULL,
      cleaned_at datetime(3) NULL,
      staging_cleaned_at datetime(3) NULL,
      KEY idx_upload_owner (owner_kind, owner_id, created_at),
      KEY idx_upload_cleanup (expires_at, staging_cleaned_at, cleaned_at),
      UNIQUE KEY uq_upload_staging_key (staging_key),
      UNIQUE KEY uq_upload_storage_key (storage_key),
      CONSTRAINT chk_upload_owner CHECK (
        (owner_kind = 'USER' AND purpose IN ('AVATAR','AFTERSALE_EVIDENCE')) OR
        (owner_kind = 'ADMIN' AND purpose IN ('CONTENT_COVER','COLUMN_COVER','CONTENT_BODY_IMAGE','PRODUCT_IMAGE','CONTENT_VIDEO'))),
      CONSTRAINT chk_upload_status CHECK (status IN ('UPLOADING','READY','FAILED','DELETED')),
      CONSTRAINT chk_upload_type CHECK (
        (kind = 'VIDEO' AND purpose = 'CONTENT_VIDEO' AND mime_type = 'video/mp4' AND size_bytes BETWEEN 1 AND 104857600 AND duration_seconds <= 86400) OR
        (kind = 'IMAGE' AND purpose <> 'CONTENT_VIDEO' AND mime_type IN ('image/jpeg','image/png','image/webp') AND size_bytes BETWEEN 1 AND 10485760 AND duration_seconds = 0)),
      CONSTRAINT chk_upload_visibility CHECK (
        (purpose IN ('AFTERSALE_EVIDENCE','CONTENT_VIDEO') AND visibility = 'PRIVATE' AND public_url IS NULL) OR
        (purpose NOT IN ('AFTERSALE_EVIDENCE','CONTENT_VIDEO') AND visibility = 'PUBLIC'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await q.query(`CREATE TABLE IF NOT EXISTS after_sale_evidence (
      id varchar(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
      created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
      updated_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
      after_sale_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      media_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      sort_order int unsigned NOT NULL,
      UNIQUE KEY uq_after_sale_evidence_media (media_id),
      KEY idx_after_sale_evidence_order (after_sale_id, sort_order),
      CONSTRAINT fk_after_sale_evidence_case FOREIGN KEY (after_sale_id) REFERENCES after_sales(id),
      CONSTRAINT fk_after_sale_evidence_media FOREIGN KEY (media_id) REFERENCES upload_media(id),
      CONSTRAINT chk_after_sale_evidence_order CHECK (sort_order < 9)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    if (!await q.hasColumn('users', 'avatar_media_id')) await q.query('ALTER TABLE users ADD COLUMN avatar_media_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NULL');
    const has = async (table: string, name: string) => (await q.query(
      'SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?', [table, name])).length > 0;
    if (!await has('users', 'fk_user_avatar_media')) await q.query('ALTER TABLE users ADD CONSTRAINT fk_user_avatar_media FOREIGN KEY (avatar_media_id) REFERENCES upload_media(id)');
    const old = await q.query(`SELECT CHECK_CLAUSE AS clause FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'chk_content_media_provider'`);
    // The OSS video branch includes both LOCAL and OSS in a single IN expression.
    if (old.length && !String(old[0].clause).replace(/_utf8mb4|\s/g, '').includes("'LOCAL','OSS'")) {
      await q.query('ALTER TABLE content_media DROP CHECK chk_content_media_provider');
    }
    if (!await has('content_media', 'chk_content_media_provider')) await q.query(`ALTER TABLE content_media ADD CONSTRAINT chk_content_media_provider CHECK (
      (kind = 'IMAGE' AND provider IN ('OSS','EXTERNAL_IMAGE') AND purpose IN ('CONTENT_COVER','COLUMN_COVER','CONTENT_BODY_IMAGE')
        AND public_url IS NOT NULL AND storage_key IS NULL AND external_url_encrypted IS NULL AND access_password_encrypted IS NULL)
      OR (kind = 'VIDEO' AND purpose = 'CONTENT_VIDEO' AND public_url IS NULL AND (
        (provider IN ('LOCAL','OSS') AND external_url_encrypted IS NULL AND access_password_encrypted IS NULL
          AND ((provider = 'LOCAL' AND storage_key IS NOT NULL) OR (provider = 'OSS' AND storage_key IS NULL)))
        OR (provider = 'BILIBILI' AND storage_key IS NULL AND external_url_encrypted IS NOT NULL AND access_password_encrypted IS NULL)
        OR (provider = 'FEISHU' AND storage_key IS NULL AND external_url_encrypted IS NOT NULL AND access_password_encrypted IS NOT NULL))))`);
  }
  async down(): Promise<void> { throw new Error('Uploads and after-sale evidence contain business data; use a reviewed backup restoration.'); }
}
