-- MySQL 8.0.16+ / 8.4, InnoDB, UTC. Run through npm run migration:run.
CREATE TABLE users (
  id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  phone varchar(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  password_hash varchar(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  nickname varchar(32) NOT NULL,
  status enum('ACTIVE','BANNED','DEACTIVATED') NOT NULL DEFAULT 'ACTIVE',
  phone_verified_at datetime(3) NULL,
  terms_version varchar(64) NOT NULL,
  privacy_version varchar(64) NOT NULL,
  consented_at datetime(3) NOT NULL,
  password_changed_at datetime(3) NULL,
  last_login_at datetime(3) NULL,
  created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  updated_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE auth_sessions (
  id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  device_label varchar(255) NOT NULL,
  expires_at datetime(3) NOT NULL,
  revoked_at datetime(3) NULL,
  last_active_at datetime(3) NOT NULL,
  created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  PRIMARY KEY (id),
  KEY idx_auth_sessions_user (user_id, revoked_at, expires_at),
  KEY idx_auth_sessions_expiry (expires_at),
  CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE refresh_tokens (
  id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  session_id varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  token_hash char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  used_at datetime(3) NULL,
  created_at datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  PRIMARY KEY (id),
  UNIQUE KEY uq_refresh_tokens_hash (token_hash),
  KEY idx_refresh_tokens_session (session_id),
  CONSTRAINT fk_refresh_tokens_session FOREIGN KEY (session_id) REFERENCES auth_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
