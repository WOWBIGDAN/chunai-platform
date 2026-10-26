import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive MySQL migration; each DDL step can be retried after an interrupted deployment. */
export class MembershipPurchasesUsers1793059200000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    const add = async (table: string, column: string, definition: string) => {
      if (!await q.hasColumn(table, column)) await q.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    };
    await add('users', 'avatar_url', 'varchar(2048) NULL');
    await add('users', 'version', 'int unsigned NOT NULL DEFAULT 1');
    await add('users', 'banned_reason', 'varchar(500) NULL');
    await add('users', 'banned_at', 'datetime(3) NULL');
    await q.query(`CREATE TABLE IF NOT EXISTS membership_plans (
      id varchar(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
      created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
      updated_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
      version int unsigned NOT NULL DEFAULT 1,
      name varchar(64) NOT NULL,
      description varchar(2000) NOT NULL,
      duration_days int unsigned NOT NULL,
      price_cents int unsigned NOT NULL,
      benefit_codes json NOT NULL,
      enabled boolean NOT NULL DEFAULT false,
      sort_order int NOT NULL DEFAULT 0,
      KEY idx_membership_plan_listing (enabled, sort_order, id),
      CONSTRAINT chk_membership_plan_values CHECK (duration_days BETWEEN 1 AND 3650 AND price_cents BETWEEN 1 AND 100000000 AND sort_order BETWEEN 0 AND 1000000)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await add('order_items', 'membership_plan_id', 'varchar(36) CHARACTER SET ascii COLLATE ascii_bin NULL');
    await add('order_items', 'membership_snapshot', 'json NULL');
    const hasConstraint = async (name: string) => (await q.query(
      'SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?',
      ['order_items', name])).length > 0;
    if (!await hasConstraint('fk_order_item_membership_plan')) await q.query(
      'ALTER TABLE order_items ADD CONSTRAINT fk_order_item_membership_plan FOREIGN KEY (membership_plan_id) REFERENCES membership_plans(id)');
    // Keep the constraint name used by the earlier migration so replaying it remains safe.
    const old = await q.query(`SELECT c.CHECK_CLAUSE AS clause FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS c
      WHERE c.CONSTRAINT_SCHEMA = DATABASE() AND c.CONSTRAINT_NAME = 'chk_order_item_resource'`);
    if (old.length && !String(old[0].clause).includes('membership_plan_id')) await q.query('ALTER TABLE order_items DROP CHECK chk_order_item_resource');
    if (!await hasConstraint('chk_order_item_resource')) await q.query(`ALTER TABLE order_items ADD CONSTRAINT chk_order_item_resource CHECK (
      (course_id IS NULL AND membership_plan_id IS NULL AND membership_snapshot IS NULL AND resource_id IS NOT NULL AND product_id IS NOT NULL)
      OR (course_id IS NOT NULL AND membership_plan_id IS NULL AND membership_snapshot IS NULL AND resource_id IS NULL AND product_id IS NULL AND quantity = 1)
      OR (membership_plan_id IS NOT NULL AND membership_snapshot IS NOT NULL AND course_id IS NULL AND resource_id IS NULL AND product_id IS NULL AND quantity = 1)
    )`);
    await q.query(`CREATE TABLE IF NOT EXISTS membership_entitlements (
      id varchar(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
      created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
      user_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      plan_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      order_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      snapshot json NOT NULL,
      starts_at datetime(3) NOT NULL,
      expires_at datetime(3) NOT NULL,
      status varchar(24) NOT NULL DEFAULT 'ACTIVE',
      revoked_at datetime(3) NULL,
      UNIQUE KEY uq_membership_entitlement_order (order_id),
      KEY idx_membership_entitlement_access (user_id, status, starts_at, expires_at),
      CONSTRAINT fk_membership_entitlement_user FOREIGN KEY (user_id) REFERENCES users(id),
      CONSTRAINT fk_membership_entitlement_plan FOREIGN KEY (plan_id) REFERENCES membership_plans(id),
      CONSTRAINT fk_membership_entitlement_order FOREIGN KEY (order_id) REFERENCES commerce_orders(id),
      CONSTRAINT chk_membership_entitlement_interval CHECK (expires_at > starts_at),
      CONSTRAINT chk_membership_entitlement_status CHECK (status IN ('ACTIVE','REFUND_PENDING','SUSPENDED','REVOKED'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }
  async down(): Promise<void> { throw new Error('Membership orders and user moderation are historical records; use a reviewed backup restoration.'); }
}
