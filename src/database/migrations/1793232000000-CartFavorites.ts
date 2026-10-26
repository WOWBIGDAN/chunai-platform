import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive and safe to retry after an interrupted MySQL DDL migration. */
export class CartFavorites1793232000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS cart_items (
      id varchar(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
      created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
      updated_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
      version int unsigned NOT NULL DEFAULT 1,
      user_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      sku_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      quantity int unsigned NOT NULL,
      selected tinyint(1) NOT NULL DEFAULT 1,
      UNIQUE KEY uq_cart_user_sku (user_id, sku_id),
      KEY idx_cart_user_created (user_id, created_at, id),
      CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_cart_sku FOREIGN KEY (sku_id) REFERENCES product_skus(id) ON DELETE CASCADE,
      CONSTRAINT chk_cart_quantity CHECK (quantity BETWEEN 1 AND 999),
      CONSTRAINT chk_cart_selected CHECK (selected IN (0, 1)),
      CONSTRAINT chk_cart_version CHECK (version >= 1)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await q.query(`CREATE TABLE IF NOT EXISTS content_favorites (
      id varchar(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
      created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
      user_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      content_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      UNIQUE KEY uq_favorite_user_content (user_id, content_id),
      KEY idx_favorite_user_created (user_id, created_at, id),
      CONSTRAINT fk_favorite_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_favorite_content FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    if (!await q.hasColumn('order_quotes', 'cart_items')) await q.query('ALTER TABLE order_quotes ADD COLUMN cart_items json NULL');
  }
  async down(): Promise<void> { throw new Error('Cart and favorites contain user data; use a reviewed backup restoration.'); }
}
