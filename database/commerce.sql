-- Commerce migration: MySQL 8.0.16+ / 8.4. All amounts are CNY cents.
-- Additive, restartable DDL. Never recreate the authentication tables.

CREATE TABLE IF NOT EXISTS admin_accounts (
  id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  version int unsigned NOT NULL DEFAULT 1,
  updated_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  username varchar(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  display_name varchar(64) NOT NULL,
  password_hash varchar(255) NOT NULL,
  enabled tinyint(1) NOT NULL DEFAULT 1,
  permissions json NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_sessions (
  id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  admin_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  expires_at datetime(3) NOT NULL,
  revoked_at datetime(3) NULL,
  PRIMARY KEY (id),
  KEY idx_admin_session (admin_id, revoked_at, expires_at),
  FOREIGN KEY (admin_id) REFERENCES admin_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_refresh_tokens (
  id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  session_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  token_hash char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  used_at datetime(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_refresh (token_hash),
  FOREIGN KEY (session_id) REFERENCES admin_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_categories (
  id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  version int unsigned NOT NULL DEFAULT 1,
  updated_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  name varchar(32) NOT NULL,
  scope varchar(16) NOT NULL DEFAULT 'PRODUCT',
  parent_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  sort_order int NOT NULL DEFAULT 0,
  enabled tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  FOREIGN KEY (parent_id) REFERENCES product_categories(id),
  KEY idx_category_sort (sort_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_images (
  id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  public_url varchar(2048) NOT NULL,
  mime_type varchar(32) NOT NULL,
  size_bytes int unsigned NOT NULL,
  operator_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (operator_id) REFERENCES admin_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  version int unsigned NOT NULL DEFAULT 1,
  updated_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  name varchar(120) NOT NULL,
  summary varchar(2000) NOT NULL,
  category_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  cover_media_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  gallery_media_ids json NOT NULL,
  detail_html mediumtext NOT NULL,
  after_sale_policy varchar(2000) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'DRAFT',
  PRIMARY KEY (id),
  FOREIGN KEY (category_id) REFERENCES product_categories(id),
  FOREIGN KEY (cover_media_id) REFERENCES product_images(id),
  CHECK (status IN ('DRAFT','PUBLISHED','OFFLINE')),
  KEY idx_products_public (status, category_id, created_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_skus (
  id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  version int unsigned NOT NULL DEFAULT 1,
  updated_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  product_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  sku_code varchar(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  attributes json NOT NULL,
  attributes_hash char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  price_cents int unsigned NOT NULL,
  enabled tinyint(1) NOT NULL DEFAULT 1,
  on_hand_stock int unsigned NOT NULL DEFAULT 0,
  reserved_stock int unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  UNIQUE KEY uq_sku_code (sku_code),
  UNIQUE KEY uq_sku_attributes (product_id, attributes_hash),
  CHECK (reserved_stock <= on_hand_stock),
  CHECK (on_hand_stock <= 100000000),
  CHECK (price_cents BETWEEN 1 AND 100000000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_addresses (
  id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  version int unsigned NOT NULL DEFAULT 1,
  updated_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  user_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  snapshot json NOT NULL,
  is_default tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  KEY idx_address_user (user_id, is_default, created_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_quotes (
  id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  user_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  address json NOT NULL,
  items json NOT NULL,
  shipping_fee_cents int unsigned NOT NULL,
  expires_at datetime(3) NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  KEY idx_quote_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS commerce_orders (
  id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  version int unsigned NOT NULL DEFAULT 1,
  updated_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  user_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  quote_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  order_no varchar(40) NOT NULL,
  status varchar(24) NOT NULL,
  payment_status varchar(24) NOT NULL DEFAULT 'UNPAID',
  after_sale_status varchar(24) NOT NULL DEFAULT 'NONE',
  address json NOT NULL,
  items_amount_cents int unsigned NOT NULL,
  shipping_fee_cents int unsigned NOT NULL,
  payable_amount_cents int unsigned NOT NULL,
  paid_amount_cents int unsigned NOT NULL DEFAULT 0,
  refunded_amount_cents int unsigned NOT NULL DEFAULT 0,
  payment_deadline_at datetime(3) NOT NULL,
  paid_at datetime(3) NULL,
  cancelled_at datetime(3) NULL,
  completed_at datetime(3) NULL,
  cancel_reason varchar(200) NULL,
  closed_reason varchar(200) NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (quote_id) REFERENCES order_quotes(id),
  UNIQUE KEY uq_order_quote (quote_id),
  UNIQUE KEY uq_order_no (order_no),
  KEY idx_order_user (user_id, created_at, id),
  KEY idx_order_expiry (status, payment_deadline_at),
  CHECK (status IN ('PENDING_PAYMENT','PENDING_SHIPMENT','PENDING_RECEIPT','COMPLETED','CANCELLED','CLOSED')),
  CHECK (payment_status IN ('UNPAID','PAID','PARTIALLY_REFUNDED','REFUNDED')),
  CHECK (after_sale_status IN ('NONE','PROCESSING','PARTIALLY_COMPLETED','COMPLETED')),
  CHECK (payable_amount_cents = items_amount_cents + shipping_fee_cents),
  CHECK (paid_amount_cents <= payable_amount_cents),
  CHECK (refunded_amount_cents <= paid_amount_cents),
  CHECK (payable_amount_cents <= 100000000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  order_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  resource_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  product_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  title varchar(120) NOT NULL,
  sku_attributes json NOT NULL,
  cover_url varchar(2048) NULL,
  quantity int unsigned NOT NULL,
  unit_price_cents int unsigned NOT NULL,
  subtotal_cents int unsigned NOT NULL,
  refunded_quantity int unsigned NOT NULL DEFAULT 0,
  refunded_amount_cents int unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  FOREIGN KEY (order_id) REFERENCES commerce_orders(id),
  FOREIGN KEY (resource_id) REFERENCES product_skus(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  UNIQUE KEY uq_order_sku (order_id, resource_id),
  CHECK (quantity BETWEEN 1 AND 999),
  CHECK (subtotal_cents = quantity * unit_price_cents),
  CHECK (refunded_quantity <= quantity),
  CHECK (refunded_amount_cents <= subtotal_cents)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock_movements (
  id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  sku_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  delta int NOT NULL,
  reserved_delta int NOT NULL,
  on_hand_stock_after int unsigned NOT NULL,
  reserved_stock_after int unsigned NOT NULL,
  reason varchar(200) NOT NULL,
  operator_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  order_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (sku_id) REFERENCES product_skus(id),
  FOREIGN KEY (order_id) REFERENCES commerce_orders(id),
  KEY idx_stock_history (sku_id, created_at, id),
  CHECK (reserved_stock_after <= on_hand_stock_after)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shipments (
  id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  version int unsigned NOT NULL DEFAULT 1,
  updated_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  order_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  carrier_code varchar(32) NOT NULL,
  carrier_name varchar(64) NOT NULL,
  tracking_no varchar(64) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'PENDING_PICKUP',
  shipped_at datetime(3) NOT NULL,
  delivered_at datetime(3) NULL,
  last_synced_at datetime(3) NULL,
  items json NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (order_id) REFERENCES commerce_orders(id),
  UNIQUE KEY uq_order_shipment (order_id),
  UNIQUE KEY uq_tracking (carrier_code, tracking_no),
  CHECK (status IN ('PENDING_PICKUP','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED','EXCEPTION'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS logistics_events (
  id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  shipment_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  time datetime(3) NOT NULL,
  description varchar(500) NOT NULL,
  location varchar(100) NULL,
  source varchar(16) NOT NULL DEFAULT 'MANUAL',
  PRIMARY KEY (id),
  FOREIGN KEY (shipment_id) REFERENCES shipments(id),
  KEY idx_logistics_time (shipment_id, time, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS after_sales (
  id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  version int unsigned NOT NULL DEFAULT 1,
  updated_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  user_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  order_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  after_sale_no varchar(40) NOT NULL,
  type varchar(16) NOT NULL,
  status varchar(24) NOT NULL,
  items_refund_amount_cents int unsigned NOT NULL,
  shipping_refund_amount_cents int unsigned NOT NULL,
  refund_amount_cents int unsigned NOT NULL,
  reason_code varchar(24) NOT NULL,
  description varchar(2000) NOT NULL,
  review_note varchar(1000) NULL,
  return_deadline_at datetime(3) NULL,
  return_address json NULL,
  return_shipment json NULL,
  refund_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (order_id) REFERENCES commerce_orders(id),
  UNIQUE KEY uq_aftersale_no (after_sale_no),
  KEY idx_aftersale_user (user_id, created_at, id),
  KEY idx_aftersale_expiry (status, return_deadline_at),
  CHECK (type IN ('REFUND_ONLY','RETURN_REFUND')),
  CHECK (status IN ('PENDING_REVIEW','AWAITING_RETURN','RETURNING','REFUNDING','REFUND_FAILED','REJECTED','CANCELLED','CLOSED','COMPLETED')),
  CHECK (refund_amount_cents = items_refund_amount_cents + shipping_refund_amount_cents),
  active_order_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS (CASE WHEN status IN ('PENDING_REVIEW','AWAITING_RETURN','RETURNING','REFUNDING','REFUND_FAILED') THEN order_id ELSE NULL END) STORED,
  UNIQUE KEY uq_active_aftersale_order (active_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS after_sale_items (
  id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  after_sale_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  order_item_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  quantity int unsigned NOT NULL,
  refund_amount_cents int unsigned NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (after_sale_id) REFERENCES after_sales(id),
  FOREIGN KEY (order_item_id) REFERENCES order_items(id),
  UNIQUE KEY uq_aftersale_item (after_sale_id, order_item_id),
  CHECK (quantity BETWEEN 1 AND 999),
  CHECK (refund_amount_cents > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_records (
  id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  order_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  provider varchar(16) NOT NULL,
  transaction_no varchar(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  amount_cents int unsigned NOT NULL,
  operator_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (order_id) REFERENCES commerce_orders(id),
  FOREIGN KEY (operator_id) REFERENCES admin_accounts(id),
  UNIQUE KEY uq_payment_order (order_id),
  UNIQUE KEY uq_payment_transaction (provider, transaction_no),
  CHECK (provider = 'TEST'),
  CHECK (amount_cents > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refunds (
  id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  order_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  after_sale_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  payment_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  amount_cents int unsigned NOT NULL,
  status varchar(16) NOT NULL,
  failure_code varchar(64) NULL,
  completed_at datetime(3) NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (order_id) REFERENCES commerce_orders(id),
  FOREIGN KEY (after_sale_id) REFERENCES after_sales(id),
  FOREIGN KEY (payment_id) REFERENCES payment_records(id),
  UNIQUE KEY uq_refund_aftersale (after_sale_id),
  CHECK (status IN ('PENDING','PROCESSING','SUCCEEDED','FAILED')),
  CHECK (amount_cents > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS idempotency_records (
  id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  actor_key varchar(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_key varchar(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_hash char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  response json NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_actor_idempotency (actor_key, request_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS commerce_audit_logs (
  id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  actor_key varchar(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  action varchar(100) NOT NULL,
  resource_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  details json NOT NULL,
  PRIMARY KEY (id),
  KEY idx_audit_time (created_at, id),
  KEY idx_audit_resource (resource_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
