import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive, retryable MySQL DDL; preserves existing media and purchased courses. */
export class ExternalMediaMembership1792972800000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    const add = async (column: string, definition: string) => {
      if (!await q.hasColumn('content_media', column)) await q.query(`ALTER TABLE content_media ADD COLUMN ${column} ${definition}`);
    };
    await add('provider', "varchar(24) NOT NULL DEFAULT 'LOCAL'");
    await add('external_url_encrypted', 'text NULL');
    await add('access_password_encrypted', 'text NULL');
    await q.query("UPDATE content_media SET provider = CASE WHEN public_url LIKE 'https://chunai-photo.oss-cn-hangzhou.aliyuncs.com/%' THEN 'OSS' ELSE 'EXTERNAL_IMAGE' END WHERE kind = 'IMAGE' AND provider = 'LOCAL'");
    const checks = async (table: string): Promise<{ name: string; clause: string }[]> => q.query(
      `SELECT t.CONSTRAINT_NAME AS name, c.CHECK_CLAUSE AS clause
       FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS t JOIN INFORMATION_SCHEMA.CHECK_CONSTRAINTS c
         ON c.CONSTRAINT_SCHEMA = t.CONSTRAINT_SCHEMA AND c.CONSTRAINT_NAME = t.CONSTRAINT_NAME
       WHERE t.TABLE_SCHEMA = DATABASE() AND t.TABLE_NAME = ? AND t.CONSTRAINT_TYPE = 'CHECK'`, [table]);
    const removeOld = async (table: string, match: (clause: string) => boolean) => {
      for (const c of await checks(table)) if (match(c.clause.toLowerCase())) {
        if (!/^[a-zA-Z0-9_]+$/.test(c.name)) throw new Error('Unexpected constraint identifier');
        await q.query(`ALTER TABLE ${table} DROP CHECK \`${c.name}\``);
      }
    };
    await removeOld('content_media', c => c.includes('storage_key') && !c.includes('provider'));
    if (!(await checks('content_media')).some(c => c.name === 'chk_content_media_provider')) await q.query(`
      ALTER TABLE content_media ADD CONSTRAINT chk_content_media_provider CHECK (
        (kind = 'IMAGE' AND provider IN ('OSS','EXTERNAL_IMAGE') AND purpose IN ('CONTENT_COVER','COLUMN_COVER','CONTENT_BODY_IMAGE')
          AND public_url IS NOT NULL AND storage_key IS NULL AND external_url_encrypted IS NULL AND access_password_encrypted IS NULL)
        OR (kind = 'VIDEO' AND purpose = 'CONTENT_VIDEO' AND public_url IS NULL AND (
          (provider = 'LOCAL' AND storage_key IS NOT NULL AND external_url_encrypted IS NULL AND access_password_encrypted IS NULL)
          OR (provider = 'BILIBILI' AND storage_key IS NULL AND external_url_encrypted IS NOT NULL AND access_password_encrypted IS NULL)
          OR (provider = 'FEISHU' AND storage_key IS NULL AND external_url_encrypted IS NOT NULL AND access_password_encrypted IS NOT NULL)
        )))`);
    await removeOld('contents', c => c.includes('access_policy') && c.includes('price_cents') && !c.includes('member'));
    if (!(await checks('contents')).some(c => c.name === 'chk_content_price_policy')) await q.query(`
      ALTER TABLE contents ADD CONSTRAINT chk_content_price_policy CHECK (
        (access_policy IN ('FREE','MEMBER') AND price_cents = 0)
        OR (access_policy = 'PURCHASE' AND price_cents BETWEEN 1 AND 100000000))`);
    await q.query(`CREATE TABLE IF NOT EXISTS user_memberships (
      id varchar(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
      created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
      updated_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
      version int unsigned NOT NULL DEFAULT 1,
      user_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      starts_at datetime(3) NOT NULL,
      expires_at datetime(3) NOT NULL,
      revoked_at datetime(3) NULL,
      reason varchar(500) NOT NULL,
      operator_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      UNIQUE KEY uq_user_membership (user_id),
      CONSTRAINT fk_membership_user FOREIGN KEY (user_id) REFERENCES users(id),
      CONSTRAINT fk_membership_operator FOREIGN KEY (operator_id) REFERENCES admin_accounts(id),
      CONSTRAINT chk_membership_interval CHECK (expires_at > starts_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }
  async down(): Promise<void> { throw new Error('External media and membership data require a reviewed restoration; automatic deletion is disabled.'); }
}
