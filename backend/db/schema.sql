-- Community Blood Donation Matching System
-- Bootstrap + Module 01 (Identity & Security) schema.
--
-- Module 01 adds only the `users` table. Domain tables (hospitals, blood banks,
-- donors, inventory, requests, broadcasts, allocations, pledges, locations,
-- notifications, surge) are added in later modules (see docs/modules.md).
--
-- This file is executed on every startup and MUST be idempotent.

PRAGMA foreign_keys = ON;

-- Key/value table: gives the app a table to query for its connectivity check
-- and a place to record the current schema version.
CREATE TABLE IF NOT EXISTS app_meta (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- schema_version is upserted so re-running the bootstrap keeps it current.
INSERT INTO app_meta (key, value)
VALUES ('schema_version', '1')
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

INSERT INTO app_meta (key, value)
VALUES ('bootstrapped_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 01.01 Users
-- ---------------------------------------------------------------------------
-- email is stored already normalized (trimmed + lower-cased) by the service.
CREATE TABLE IF NOT EXISTS users (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  email                 TEXT    NOT NULL UNIQUE,
  password_hash         TEXT    NOT NULL,
  role                  TEXT    NOT NULL CHECK (role IN ('ADMIN', 'HOSPITAL', 'BLOOD_BANK', 'DONOR')),
  is_verified           INTEGER NOT NULL DEFAULT 0 CHECK (is_verified IN (0, 1)),
  is_active             INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  failed_login_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0),
  locked_until          TEXT,
  created_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Keep updated_at fresh on any row change. Recursive triggers are OFF by
-- default in SQLite, so the inner UPDATE does not re-fire this trigger.
CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
  UPDATE users SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
END;
