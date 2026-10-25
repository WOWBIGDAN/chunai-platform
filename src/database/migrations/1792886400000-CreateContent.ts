import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Each ALTER is guarded so a MySQL DDL interruption can be retried safely. */
export class CreateContent1792886400000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    const sql = readFileSync(resolve(__dirname, '../../../database/content.sql'), 'utf8');
    for (const statement of sql.split(/;\s*(?:\r?\n|$)/).filter(s => s.trim())) await q.query(statement);
    const add = async (table: string, column: string, definition: string) => {
      if (!await q.hasColumn(table, column)) await q.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    };
    await add('order_quotes', 'type', "varchar(16) NOT NULL DEFAULT 'PRODUCT'");
    await add('commerce_orders', 'type', "varchar(16) NOT NULL DEFAULT 'PRODUCT'");
    for (const table of ['order_quotes', 'commerce_orders']) await q.query(`ALTER TABLE ${table} MODIFY address json NULL`);
    await q.query('ALTER TABLE order_items MODIFY resource_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NULL, MODIFY product_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NULL');
    await add('order_items', 'course_id', 'varchar(36) CHARACTER SET ascii COLLATE ascii_bin NULL');
    // MySQL's TypeORM table introspection omits CHECK constraints; query the catalog directly.
    const hasConstraint = async (name: string) => (await q.query(
      'SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?',
      ['order_items', name])).length > 0;
    if (!await hasConstraint('fk_order_item_course'))
      await q.query('ALTER TABLE order_items ADD CONSTRAINT fk_order_item_course FOREIGN KEY (course_id) REFERENCES contents(id)');
    if (!await hasConstraint('chk_order_item_resource'))
      await q.query('ALTER TABLE order_items ADD CONSTRAINT chk_order_item_resource CHECK ((course_id IS NULL AND resource_id IS NOT NULL AND product_id IS NOT NULL) OR (course_id IS NOT NULL AND resource_id IS NULL AND product_id IS NULL AND quantity = 1))');
    await q.query('ALTER TABLE refunds MODIFY after_sale_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NULL');
    await add('refunds', 'version', 'int unsigned NOT NULL DEFAULT 1');
  }
  async down(): Promise<void> { throw new Error('Content and purchased access are historical records. Use a reviewed backup restoration.'); }
}
