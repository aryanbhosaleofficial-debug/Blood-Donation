-- Community Blood Donation Matching System
-- Bootstrap through Module 04 (Atomic Blood-Bank Allocation) schema.
--
-- Module 01 adds `users`; Module 02 adds organization profiles and inventory;
-- Module 03 adds `requests` and `request_broadcasts`.
-- Module 04 adds atomic bank allocations. Later donor, notification, and surge
-- domains are intentionally absent.
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
VALUES ('schema_version', '4')
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

-- ---------------------------------------------------------------------------
-- Module 02: organization profiles and red-cell inventory
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hospitals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  registration_reference TEXT NOT NULL UNIQUE,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  locality TEXT,
  pin_code TEXT,
  latitude REAL CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  longitude REAL CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
  verified_at TEXT,
  verified_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS blood_banks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  license_no TEXT NOT NULL UNIQUE,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  locality TEXT,
  pin_code TEXT,
  latitude REAL CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  longitude REAL CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
  verified_at TEXT,
  verified_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bank_id INTEGER NOT NULL REFERENCES blood_banks(id) ON DELETE CASCADE,
  blood_group TEXT NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  component TEXT NOT NULL CHECK (component = 'RED_CELLS'),
  units_available INTEGER NOT NULL DEFAULT 0 CHECK (typeof(units_available) = 'integer' AND units_available >= 0),
  version INTEGER NOT NULL DEFAULT 0 CHECK (typeof(version) = 'integer' AND version >= 0),
  updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (bank_id, blood_group, component)
);

CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inventory_id INTEGER NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  bank_id INTEGER NOT NULL REFERENCES blood_banks(id) ON DELETE CASCADE,
  actor_user_id INTEGER NOT NULL REFERENCES users(id),
  previous_units INTEGER NOT NULL,
  new_units INTEGER NOT NULL,
  previous_version INTEGER NOT NULL,
  new_version INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_inventory_bank ON inventory(bank_id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_inventory ON inventory_adjustments(inventory_id);

CREATE TRIGGER IF NOT EXISTS trg_hospitals_updated_at AFTER UPDATE ON hospitals
FOR EACH ROW BEGIN
  UPDATE hospitals SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_blood_banks_updated_at AFTER UPDATE ON blood_banks
FOR EACH ROW BEGIN
  UPDATE blood_banks SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
END;

-- ---------------------------------------------------------------------------
-- Module 03: emergency requests and blood-bank broadcasts
-- ---------------------------------------------------------------------------
-- Request state model is intentionally small: OPEN | COVERED | COMPLETED |
-- CANCELLED | EXPIRED. Module 03 only reaches OPEN, COMPLETED, CANCELLED.
-- COVERED is set by Module 04 allocations; EXPIRED by a later cleanup job.
CREATE TABLE IF NOT EXISTS requests (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  client_request_id TEXT    NOT NULL,
  hospital_id       INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  blood_group       TEXT    NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  component         TEXT    NOT NULL DEFAULT 'RED_CELLS' CHECK (component = 'RED_CELLS'),
  units_needed      INTEGER NOT NULL CHECK (typeof(units_needed) = 'integer' AND units_needed >= 1),
  backup_slots      INTEGER NOT NULL DEFAULT 0 CHECK (typeof(backup_slots) = 'integer' AND backup_slots >= 0),
  urgency           TEXT    NOT NULL CHECK (urgency IN ('NORMAL', 'URGENT', 'CRITICAL')),
  status            TEXT    NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'COVERED', 'COMPLETED', 'CANCELLED', 'EXPIRED')),
  note              TEXT,
  is_synthetic      INTEGER NOT NULL DEFAULT 0 CHECK (is_synthetic IN (0, 1)),
  scenario_id       TEXT,
  created_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at        TEXT    NOT NULL,
  closed_at         TEXT,
  UNIQUE (hospital_id, client_request_id)
);

CREATE INDEX IF NOT EXISTS idx_requests_hospital ON requests(hospital_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);

CREATE TABLE IF NOT EXISTS request_broadcasts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id   INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  bank_id      INTEGER NOT NULL REFERENCES blood_banks(id) ON DELETE CASCADE,
  status       TEXT    NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VIEWED', 'CLOSED')),
  sent_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  responded_at TEXT,
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (request_id, bank_id)
);

CREATE INDEX IF NOT EXISTS idx_request_broadcasts_bank ON request_broadcasts(bank_id);
CREATE INDEX IF NOT EXISTS idx_request_broadcasts_request ON request_broadcasts(request_id);

-- ---------------------------------------------------------------------------
-- Module 04: one atomic blood-bank allocation per bank/request
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS request_allocations (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id     INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  bank_id        INTEGER NOT NULL REFERENCES blood_banks(id) ON DELETE CASCADE,
  units_reserved INTEGER NOT NULL CHECK (typeof(units_reserved) = 'integer' AND units_reserved > 0),
  status         TEXT NOT NULL DEFAULT 'RESERVED' CHECK (status IN ('RESERVED', 'RELEASED', 'COMPLETED')),
  reserved_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  released_at    TEXT,
  completed_at   TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (request_id, bank_id)
);

CREATE INDEX IF NOT EXISTS idx_request_allocations_request ON request_allocations(request_id);
CREATE INDEX IF NOT EXISTS idx_request_allocations_bank ON request_allocations(bank_id);
CREATE INDEX IF NOT EXISTS idx_request_allocations_status ON request_allocations(status);
