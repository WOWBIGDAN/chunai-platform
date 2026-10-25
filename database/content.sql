-- Additive content tables. Run npm run migration:run to also upgrade existing commerce columns.
CREATE TABLE IF NOT EXISTS content_media (
  id varchar(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  kind varchar(16) NOT NULL,
  purpose varchar(32) NOT NULL,
  public_url varchar(2048) NULL,
  storage_key varchar(64) NULL,
  mime_type varchar(32) NOT NULL,
  size_bytes int unsigned NOT NULL,
  duration_seconds int unsigned NOT NULL DEFAULT 0,
  operator_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  FOREIGN KEY (operator_id) REFERENCES admin_accounts(id),
  UNIQUE KEY uq_content_storage (storage_key),
  CHECK ((kind = 'VIDEO' AND purpose = 'CONTENT_VIDEO' AND public_url IS NULL AND storage_key IS NOT NULL)
    OR (kind = 'IMAGE' AND purpose IN ('CONTENT_COVER','COLUMN_COVER','CONTENT_BODY_IMAGE') AND public_url IS NOT NULL AND storage_key IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contents (
  id varchar(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  updated_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  version int unsigned NOT NULL DEFAULT 1,
  kind varchar(24) NOT NULL,
  title varchar(120) NOT NULL,
  summary varchar(2000) NOT NULL,
  description_html mediumtext NOT NULL,
  cover_media_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  category_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  author_name varchar(64) NOT NULL,
  tags json NOT NULL,
  access_policy varchar(24) NOT NULL,
  price_cents int unsigned NOT NULL,
  body_html mediumtext NULL,
  image_media_ids json NOT NULL,
  video_media_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  status varchar(16) NOT NULL DEFAULT 'DRAFT',
  published_at datetime(3) NULL,
  FOREIGN KEY (cover_media_id) REFERENCES content_media(id),
  FOREIGN KEY (category_id) REFERENCES product_categories(id),
  FOREIGN KEY (video_media_id) REFERENCES content_media(id),
  KEY idx_content_browse (status, kind, published_at, id),
  KEY idx_content_category (category_id, status),
  CHECK (kind IN ('SCIENCE_ARTICLE','SCIENCE_VIDEO','ARTICLE_COURSE','VIDEO_COURSE')),
  CHECK (status IN ('DRAFT','PUBLISHED','OFFLINE')),
  CHECK ((access_policy = 'FREE' AND price_cents = 0) OR (access_policy = 'PURCHASE' AND price_cents BETWEEN 1 AND 100000000)),
  CHECK (kind IN ('ARTICLE_COURSE','VIDEO_COURSE') OR access_policy = 'FREE')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS course_chapters (
  id varchar(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  updated_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  version int unsigned NOT NULL DEFAULT 1,
  course_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  title varchar(120) NOT NULL,
  kind varchar(16) NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_preview tinyint NOT NULL DEFAULT 0,
  body_html mediumtext NULL,
  image_media_ids json NOT NULL,
  video_media_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  status varchar(16) NOT NULL DEFAULT 'DRAFT',
  published_at datetime(3) NULL,
  FOREIGN KEY (course_id) REFERENCES contents(id),
  FOREIGN KEY (video_media_id) REFERENCES content_media(id),
  KEY idx_chapter_course (course_id, status, sort_order, id),
  CHECK (kind IN ('ARTICLE','VIDEO')),
  CHECK (status IN ('DRAFT','PUBLISHED','OFFLINE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS content_columns (
  id varchar(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  updated_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  version int unsigned NOT NULL DEFAULT 1,
  name varchar(64) NOT NULL,
  description varchar(2000) NOT NULL,
  cover_media_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  status varchar(16) NOT NULL DEFAULT 'DRAFT',
  FOREIGN KEY (cover_media_id) REFERENCES content_media(id),
  KEY idx_column_browse (status, sort_order, id),
  CHECK (status IN ('DRAFT','PUBLISHED','OFFLINE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS column_contents (
  id varchar(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  column_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  content_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  FOREIGN KEY (column_id) REFERENCES content_columns(id),
  FOREIGN KEY (content_id) REFERENCES contents(id),
  UNIQUE KEY uq_column_content (column_id, content_id),
  KEY idx_column_sort (column_id, sort_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS course_entitlements (
  id varchar(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  user_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  course_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  order_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  status varchar(16) NOT NULL,
  revoked_at datetime(3) NULL,
  active_key varchar(73) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS
    (CASE WHEN status = 'ACTIVE' THEN CONCAT(user_id, ':', course_id) ELSE NULL END) STORED,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (course_id) REFERENCES contents(id),
  FOREIGN KEY (order_id) REFERENCES commerce_orders(id),
  UNIQUE KEY uq_entitlement_order (order_id),
  UNIQUE KEY uq_entitlement_active (active_key),
  KEY idx_entitlement_user (user_id, status, created_at, id),
  CHECK (status IN ('ACTIVE','REVOKED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
