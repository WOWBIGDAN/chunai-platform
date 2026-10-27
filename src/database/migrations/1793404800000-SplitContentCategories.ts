import { createHash } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Deterministic mapping also lets the optional legacy seed script find migrated course categories. */
export function legacyCourseCategoryId(id: string): string {
  const value = createHash('sha256').update('category-scopes-v1:course:' + id).digest('hex').slice(0, 32).split('');
  value[12] = '4'; value[16] = '8'; const hex = value.join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
interface LegacyCategory { id: string; parent_id: string | null; scope: string }

export class SplitContentCategories1793404800000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    // DML is atomic; retry after an interrupted MySQL DDL never clones categories twice.
    await q.startTransaction();
    try {
      const all: LegacyCategory[] = await q.query('SELECT id,parent_id,scope FROM product_categories ORDER BY id FOR UPDATE');
      if (all.some(c => !['PRODUCT', 'CONTENT', 'SCIENCE', 'COURSE'].includes(c.scope))) throw new Error('Unrecognized category scope; migrate manually');
      const legacy = all.filter(c => c.scope === 'CONTENT'); const byId = new Map(legacy.map(c => [c.id, c]));
      const ordered: LegacyCategory[] = [], visited = new Set<string>(), visiting = new Set<string>();
      const visit = (c: LegacyCategory) => {
        if (visited.has(c.id)) return;
        if (visiting.has(c.id)) throw new Error('Category hierarchy contains a cycle');
        visiting.add(c.id);
        if (c.parent_id) {
          const parent = byId.get(c.parent_id);
          if (!parent) throw new Error('Legacy content parent must use the same scope');
          visit(parent);
        }
        visiting.delete(c.id); visited.add(c.id); ordered.push(c);
      };
      legacy.forEach(visit);
      for (const c of ordered) {
        const courseId = legacyCourseCategoryId(c.id);
        if (all.some(row => row.id === courseId)) throw new Error('Migrated category UUID collision');
        await q.query(`INSERT INTO product_categories (id,created_at,updated_at,version,name,scope,parent_id,sort_order,enabled)
          SELECT ?,created_at,UTC_TIMESTAMP(3),1,name,'COURSE',?,sort_order,enabled FROM product_categories WHERE id=?`,
          [courseId, c.parent_id ? legacyCourseCategoryId(c.parent_id) : null, c.id]);
      }
      for (const c of legacy) {
        await q.query(`UPDATE contents SET category_id=?,version=version+1,updated_at=UTC_TIMESTAMP(3)
          WHERE category_id=? AND kind IN ('ARTICLE_COURSE','VIDEO_COURSE')`, [legacyCourseCategoryId(c.id), c.id]);
      }
      await q.query("UPDATE product_categories SET scope='SCIENCE',version=version+1,updated_at=UTC_TIMESTAMP(3) WHERE scope='CONTENT'");
      const mismatch = await q.query(`SELECT c.id FROM contents c JOIN product_categories cat ON cat.id=c.category_id
        WHERE cat.scope <> CASE WHEN c.kind IN ('ARTICLE_COURSE','VIDEO_COURSE') THEN 'COURSE' ELSE 'SCIENCE' END LIMIT 1`);
      if (mismatch.length) throw new Error('Content category does not match its science/course kind');
      await q.commitTransaction();
    } catch (error) { await q.rollbackTransaction(); throw error; }
    const checks = await q.query(`SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='product_categories' AND CONSTRAINT_NAME='chk_category_scope'`);
    if (!checks.length) await q.query("ALTER TABLE product_categories ADD CONSTRAINT chk_category_scope CHECK (scope IN ('PRODUCT','SCIENCE','COURSE'))");
    const [index] = await q.query("SHOW INDEX FROM product_categories WHERE Key_name='idx_category_scope'");
    if (!index) await q.query('ALTER TABLE product_categories ADD KEY idx_category_scope (scope,enabled,sort_order,id)');
  }
  async down(): Promise<void> { throw new Error('Separated categories may contain user edits; use a reviewed backup restoration.'); }
}
