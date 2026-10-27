import { MigrationInterface, QueryRunner } from 'typeorm';

export class LogisticsTracking1793318400000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    const columns: Record<string, string> = {
      query_phone_last4: 'char(4) NULL', sync_status: "varchar(16) NOT NULL DEFAULT 'PENDING'",
      sync_error_code: 'varchar(64) NULL', last_sync_attempt_at: 'datetime(3) NULL', next_sync_at: 'datetime(3) NULL',
      sync_lease_token: 'varchar(36) NULL', sync_lease_until: 'datetime(3) NULL', sync_failures: 'int unsigned NOT NULL DEFAULT 0',
    };
    for (const [name, type] of Object.entries(columns)) {
      if (!await q.hasColumn('shipments', name)) await q.query(`ALTER TABLE shipments ADD COLUMN ${name} ${type}`);
    }
    if (!await q.hasColumn('logistics_events', 'event_key')) await q.query('ALTER TABLE logistics_events ADD COLUMN event_key char(64) CHARACTER SET ascii COLLATE ascii_bin NULL');
    const events = await q.getTable('logistics_events');
    if (!events?.indices.some(i => i.name === 'uq_logistics_event_key')) await q.query('ALTER TABLE logistics_events ADD UNIQUE KEY uq_logistics_event_key (shipment_id, event_key)');
    const shipments = await q.getTable('shipments');
    if (!shipments?.indices.some(i => i.name === 'idx_shipments_sync')) await q.query('ALTER TABLE shipments ADD KEY idx_shipments_sync (next_sync_at, status, shipped_at)');
    const checks: { name: string; expression: string }[] = await q.query(`SELECT tc.CONSTRAINT_NAME AS name, cc.CHECK_CLAUSE AS expression
      FROM information_schema.TABLE_CONSTRAINTS tc JOIN information_schema.CHECK_CONSTRAINTS cc
      ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
      WHERE tc.TABLE_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'shipments' AND tc.CONSTRAINT_TYPE = 'CHECK'`);
    if (!checks.some(c => c.name === 'chk_shipment_tracking_status')) await q.query(`ALTER TABLE shipments ADD CONSTRAINT chk_shipment_tracking_status
      CHECK (status IN ('PENDING_PICKUP','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED','EXCEPTION','RETURNED'))`);
    for (const check of checks) {
      if (check.name !== 'chk_shipment_tracking_status' && /\bstatus\b/i.test(check.expression) && /PENDING_PICKUP/.test(check.expression)) {
        if (!/^[A-Za-z0-9_]+$/.test(check.name)) throw new Error('Unexpected shipment constraint identifier');
        await q.query(`ALTER TABLE shipments DROP CHECK \`${check.name}\``);
      }
    }
  }
  async down(): Promise<void> { throw new Error('Logistics tracking contains business data; restore a reviewed backup instead.'); }
}
