/* Explicit manual seeding only. Existing records, stock and versions are never reset. */
'use strict';
const { createHash, randomBytes, scryptSync } = require('node:crypto');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const { readFileSync } = require('node:fs');
const appRequire = createRequire(resolve(process.cwd(), 'package.json'));

function fixtureId(kind, key) {
  const value = createHash('sha256').update(`cs-products-v1/${kind}/${key}`).digest('hex').slice(0, 32).split('');
  value[12] = '4'; value[16] = ((parseInt(value[16], 16) & 3) | 8).toString(16);
  const hex = value.join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
function attributesHash(attributes) {
  // Matches the canonical JSON used by CatalogService.attributes().
  const canonical = JSON.stringify(attributes.map(x => ({ name: x.name, value: x.value })));
  return createHash('sha256').update(canonical).digest('hex');
}
function validate(fixtures) {
  if (fixtures.version !== 'cs-products-v1') throw new Error('Unsupported fixture version');
  const categories = new Set(fixtures.categories.map(c => c.key));
  const products = new Set(); const skuCodes = new Set();
  for (const c of fixtures.categories) if (!c.name.startsWith('cs') || c.name.length > 32) throw new Error('Every category name must start with cs');
  for (const p of fixtures.products) {
    if (!p.name.startsWith('cs') || p.name.length > 120 || products.has(p.key) || !categories.has(p.category)) throw new Error('Invalid cs product definition');
    products.add(p.key);
    if (!['DRAFT', 'PUBLISHED', 'OFFLINE'].includes(p.status)) throw new Error('Invalid product status');
    if (p.status === 'PUBLISHED' && !p.skus.some(s => s.enabled)) throw new Error('Published product needs an enabled SKU');
    const labels = new Set();
    for (const s of p.skus) {
      const code = `cs-${p.key}-${s.key}`;
      if (skuCodes.has(code) || labels.has(s.label) || !/^[A-Za-z0-9_.-]{1,64}$/.test(code) ||
          !Number.isSafeInteger(s.priceCents) || s.priceCents < 1 || s.priceCents > 100000000 ||
          !Number.isSafeInteger(s.stock) || s.stock < 0 || s.stock > 100000000 || typeof s.enabled !== 'boolean') throw new Error('Invalid SKU definition');
      skuCodes.add(code); labels.add(s.label);
    }
  }
}
async function seed(fixtures, config) {
  validate(fixtures);
  if (!['development', 'test', 'staging'].includes(config.NODE_ENV ?? 'development')) throw new Error('Sample seeding requires development, test or staging');
  for (const key of ['DB_NAME', 'DB_USER', 'DB_PASSWORD']) if (!config[key]) throw new Error(`${key} is required`);
  const db = await appRequire('mysql2/promise').createConnection({ host: config.DB_HOST ?? '127.0.0.1', port: Number(config.DB_PORT ?? 3306),
    user: config.DB_USER, password: config.DB_PASSWORD, database: config.DB_NAME, timezone: 'Z', charset: 'utf8mb4' });
  const lockName = `cs-products:${createHash('sha256').update(config.DB_NAME).digest('hex').slice(0, 24)}`;
  let locked = false;
  const created = { categories: 0, images: 0, products: 0, skus: 0, stockMovements: 0, operators: 0 };
  try {
    const [[lock]] = await db.query('SELECT GET_LOCK(?, 10) AS acquired', [lockName]);
    if (lock.acquired !== 1) throw new Error('Another sample seeding process is running');
    locked = true;
    await db.beginTransaction();
    const [tables] = await db.query('SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()');
    for (const table of ['products', 'product_skus', 'product_categories', 'product_images', 'stock_movements', 'admin_accounts', 'commerce_audit_logs']) {
      if (!tables.some(t => t.name === table)) throw new Error('Run the commerce database migration before seeding');
    }
    const operatorId = fixtureId('operator', 'disabled');
    const [[existingOperator]] = await db.query('SELECT id, username, enabled FROM admin_accounts WHERE id = ? FOR UPDATE', [operatorId]);
    if (!existingOperator) {
      const salt = randomBytes(16);
      const hash = scryptSync(randomBytes(48).toString('base64url'), salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
      await db.execute('INSERT INTO admin_accounts (id, username, display_name, password_hash, enabled, permissions) VALUES (?, ?, ?, ?, 0, ?)',
        [operatorId, 'cs_seed_operator', 'cs样本初始化（停用）', `scrypt$32768$8$1$${salt.toString('hex')}$${hash.toString('hex')}`, '[]']);
      created.operators++;
    } else if (existingOperator.username !== 'cs_seed_operator' || existingOperator.enabled) {
      throw new Error('Reserved sample operator conflicts with an existing administrator');
    }
    for (const c of fixtures.categories) {
      const id = fixtureId('category', c.key);
      const [[existing]] = await db.query('SELECT id, name FROM product_categories WHERE id = ? FOR UPDATE', [id]);
      if (existing) { if (!existing.name.startsWith('cs')) throw new Error('Sample category ID collision'); continue; }
      await db.execute('INSERT INTO product_categories (id, name, scope, parent_id, sort_order, enabled) VALUES (?, ?, ?, NULL, ?, 1)', [id, c.name, 'PRODUCT', c.sortOrder]);
      created.categories++;
    }
    let position = 0;
    for (const p of fixtures.products) {
      position++;
      const productId = fixtureId('product', p.key);
      const [[existing]] = await db.query('SELECT id, name FROM products WHERE id = ? FOR UPDATE', [productId]);
      // Skip the whole existing product so rerunning cannot change any CRUD test edits or inventory.
      if (existing) { if (!existing.name.startsWith('cs')) throw new Error('Sample product ID collision'); continue; }
      const imageId = fixtureId('image', p.key);
      const [[existingImage]] = await db.query('SELECT id FROM product_images WHERE id = ?', [imageId]);
      if (!existingImage) {
        // Public placeholder only; no remote download or external service credentials are needed.
        await db.execute('INSERT INTO product_images (id, public_url, mime_type, size_bytes, operator_id) VALUES (?, ?, ?, ?, ?)',
          [imageId, `https://placehold.co/640x480/png?text=cs+sample+${position}`, 'image/png', 1024, operatorId]);
        created.images++;
      }
      await db.execute('INSERT INTO products (id, name, summary, category_id, cover_media_id, gallery_media_ids, detail_html, after_sale_policy, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [productId, p.name, p.summary, fixtureId('category', p.category), imageId, '[]',
          `<p>${p.name}</p><p>${p.summary}</p><p>cs测试数据，仅用于接口联调。</p>`, 'cs测试售后规则：确认收货后七天内可申请，金额以服务端成交快照为准。', p.status]);
      created.products++;
      for (const s of p.skus) {
        const skuId = fixtureId('sku', `${p.key}/${s.key}`);
        const attrs = [{ name: '规格', value: s.label }];
        await db.execute('INSERT INTO product_skus (id, product_id, sku_code, attributes, attributes_hash, price_cents, enabled, on_hand_stock, reserved_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)',
          [skuId, productId, `cs-${p.key}-${s.key}`, JSON.stringify(attrs), attributesHash(attrs), s.priceCents, s.enabled, s.stock]);
        created.skus++;
        if (s.stock > 0) {
          await db.execute('INSERT INTO stock_movements (id, sku_id, delta, reserved_delta, on_hand_stock_after, reserved_stock_after, reason, operator_id, order_id) VALUES (?, ?, ?, 0, ?, 0, ?, ?, NULL)',
            [fixtureId('stock', `${p.key}/${s.key}`), skuId, s.stock, s.stock, 'cs测试样本初始入库', operatorId]);
          created.stockMovements++;
        }
      }
      await db.execute('INSERT INTO commerce_audit_logs (id, actor_key, action, resource_id, details) VALUES (?, ?, ?, ?, ?)',
        [require('node:crypto').randomUUID(), 'system:cs-product-seed', 'product.sample-create', productId, JSON.stringify({ name: p.name, fixtureVersion: fixtures.version })]);
    }
    await db.commit();
    const products = [];
    for (const p of fixtures.products) {
      const [[row]] = await db.query('SELECT id, name, status, version FROM products WHERE id = ?', [fixtureId('product', p.key)]);
      if (!row) throw new Error('Sample verification failed');
      const [skus] = await db.query('SELECT id, sku_code AS skuCode, price_cents AS priceCents, enabled, on_hand_stock AS onHandStock, reserved_stock AS reservedStock, version FROM product_skus WHERE product_id = ? ORDER BY sku_code', [row.id]);
      products.push({ ...row, skus });
    }
    return { database: config.DB_NAME, environment: config.NODE_ENV ?? 'development', fixtureVersion: fixtures.version, created, products };
  } catch (error) { await db.rollback(); throw error; }
  finally {
    if (locked) await db.query('SELECT RELEASE_LOCK(?)', [lockName]);
    await db.end();
  }
}
async function main() {
  const envPath = process.env.SEED_ENV_FILE;
  const dotenv = appRequire('dotenv');
  const config = envPath ? { ...process.env, ...dotenv.parse(readFileSync(envPath)) }
    : { ...dotenv.config({ quiet: true }).parsed, ...process.env };
  const fixturePath = process.argv[2] ?? resolve(process.cwd(), 'database/seeds/cs-products.json');
  const report = await seed(JSON.parse(readFileSync(fixturePath, 'utf8')), config);
  console.log(JSON.stringify(report, null, 2));
}
if (require.main === module) main().catch(error => {
  console.error(JSON.stringify({ error: error.code || error.name, message: error.code ? 'Sample seeding failed; transaction rolled back. Check migration, connectivity and uniqueness constraints.' : error.message }));
  process.exitCode = 1;
});
module.exports = { seed, fixtureId, validate };
