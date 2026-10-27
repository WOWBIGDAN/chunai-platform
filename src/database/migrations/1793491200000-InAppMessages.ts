import { MigrationInterface, QueryRunner } from 'typeorm';

export class InAppMessages1793491200000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    // user_id is a logical reference. A users FK would acquire a user lock after
    // commerce order locks and invert the existing user -> order lock order.
    await q.query(`CREATE TABLE IF NOT EXISTS user_message_states (
      user_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
      next_sequence bigint unsigned NOT NULL DEFAULT 0,
      revision bigint unsigned NOT NULL DEFAULT 0,
      unread_count int unsigned NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await q.query(`CREATE TABLE IF NOT EXISTS user_messages (
      id varchar(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
      user_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      sequence bigint unsigned NOT NULL,
      event_key varchar(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      category varchar(16) NOT NULL,
      title varchar(120) NOT NULL,
      body varchar(2000) NOT NULL,
      resource_type varchar(16) NULL,
      resource_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
      read_at datetime(3) NULL,
      deleted_at datetime(3) NULL,
      created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
      UNIQUE KEY uq_message_user_sequence (user_id, sequence),
      UNIQUE KEY uq_message_user_event (user_id, event_key),
      KEY idx_message_history (user_id, deleted_at, sequence),
      KEY idx_message_unread (user_id, deleted_at, read_at, sequence),
      CONSTRAINT fk_message_state FOREIGN KEY (user_id) REFERENCES user_message_states(user_id) ON DELETE CASCADE,
      CONSTRAINT chk_message_category CHECK (category IN ('ORDER', 'AFTERSALE', 'MEMBERSHIP', 'SYSTEM')),
      CONSTRAINT chk_message_resource CHECK ((resource_type IS NULL AND resource_id IS NULL) OR
        (resource_type IS NOT NULL AND resource_id IS NOT NULL AND resource_type IN ('ORDER', 'AFTERSALE', 'MEMBERSHIP'))),
      CONSTRAINT chk_message_sequence CHECK (sequence > 0)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    // Extend only existing full administrators; limited operators keep their scope.
    const previous = ['media:write', 'content:write', 'membership:write', 'users:read', 'users:ban',
      'products:write', 'orders:read', 'orders:ship', 'aftersales:review', 'payments:test', 'audit:read'];
    await q.query(`UPDATE admin_accounts SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'messages:write'),
      version = version + 1, updated_at = UTC_TIMESTAMP(3)
      WHERE JSON_CONTAINS(permissions, CAST(? AS JSON)) AND NOT JSON_CONTAINS(permissions, '"messages:write"')`, [JSON.stringify(previous)]);
  }
  async down(): Promise<void> { throw new Error('Messages contain user data; use a reviewed backup restoration.'); }
}
