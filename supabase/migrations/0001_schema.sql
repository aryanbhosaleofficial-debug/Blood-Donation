-- ===========================================================================
-- Community Blood Donation Matching System — Supabase / PostgreSQL schema
-- Migration 0001: tables, constraints, indexes, updated_at triggers.
--
-- This is the PostgreSQL translation of backend/db/schema.sql (SQLite,
-- schema_version 9). It preserves every relationship, UNIQUE / CHECK
-- constraint and index. Type mapping:
--   INTEGER PK AUTOINCREMENT  -> BIGINT GENERATED ALWAYS AS IDENTITY
--   TEXT ISO timestamp        -> TIMESTAMPTZ (UTC semantics)
--   INTEGER 0/1               -> BOOLEAN
--   *_json TEXT               -> JSONB
--   REAL                      -> DOUBLE PRECISION
--
-- Idempotent: safe to run repeatedly (IF NOT EXISTS / CREATE OR REPLACE).
-- Run order: 0001_schema.sql -> 0002_functions.sql -> 0003_grants.sql
-- ===========================================================================

-- Shared trigger: keep updated_at fresh on any UPDATE.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- app_meta — connectivity check + schema version marker
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_meta (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO app_meta (key, value) VALUES ('schema_version', '10-pg')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
INSERT INTO app_meta (key, value) VALUES ('database_provider', 'supabase-postgresql')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
INSERT INTO app_meta (key, value) VALUES ('bootstrapped_at', now()::text)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Module 01 — users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email                 TEXT    NOT NULL UNIQUE,
  password_hash         TEXT    NOT NULL,
  role                  TEXT    NOT NULL CHECK (role IN ('ADMIN','HOSPITAL','BLOOD_BANK','DONOR')),
  is_verified           BOOLEAN NOT NULL DEFAULT false,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0),
  locked_until          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (lower(email));
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Module 02 — organization profiles + red-cell inventory
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hospitals (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  registration_reference TEXT NOT NULL UNIQUE,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  locality TEXT,
  pin_code TEXT,
  latitude  DOUBLE PRECISION CHECK (latitude  IS NULL OR (latitude  BETWEEN -90  AND 90)),
  longitude DOUBLE PRECISION CHECK (longitude IS NULL OR (longitude BETWEEN -180 AND 180)),
  verified_at TIMESTAMPTZ,
  verified_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_hospitals_updated_at ON hospitals;
CREATE TRIGGER trg_hospitals_updated_at BEFORE UPDATE ON hospitals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS blood_banks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  license_no TEXT NOT NULL UNIQUE,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  locality TEXT,
  pin_code TEXT,
  latitude  DOUBLE PRECISION CHECK (latitude  IS NULL OR (latitude  BETWEEN -90  AND 90)),
  longitude DOUBLE PRECISION CHECK (longitude IS NULL OR (longitude BETWEEN -180 AND 180)),
  verified_at TIMESTAMPTZ,
  verified_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_blood_banks_updated_at ON blood_banks;
CREATE TRIGGER trg_blood_banks_updated_at BEFORE UPDATE ON blood_banks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS inventory (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bank_id BIGINT NOT NULL REFERENCES blood_banks(id) ON DELETE CASCADE,
  blood_group TEXT NOT NULL CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  component TEXT NOT NULL CHECK (component = 'RED_CELLS'),
  units_available INTEGER NOT NULL DEFAULT 0 CHECK (units_available >= 0),
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  updated_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bank_id, blood_group, component)
);
CREATE INDEX IF NOT EXISTS idx_inventory_bank ON inventory(bank_id);
DROP TRIGGER IF EXISTS trg_inventory_updated_at ON inventory;
CREATE TRIGGER trg_inventory_updated_at BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  inventory_id BIGINT NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  bank_id BIGINT NOT NULL REFERENCES blood_banks(id) ON DELETE CASCADE,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  previous_units INTEGER NOT NULL,
  new_units INTEGER NOT NULL,
  previous_version INTEGER NOT NULL,
  new_version INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_inventory ON inventory_adjustments(inventory_id);

-- ---------------------------------------------------------------------------
-- Module 03 — emergency requests + blood-bank broadcasts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS requests (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_request_id TEXT    NOT NULL,
  hospital_id       BIGINT  NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  blood_group       TEXT    NOT NULL CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  component         TEXT    NOT NULL DEFAULT 'RED_CELLS' CHECK (component = 'RED_CELLS'),
  units_needed      INTEGER NOT NULL CHECK (units_needed >= 1),
  backup_slots      INTEGER NOT NULL DEFAULT 0 CHECK (backup_slots >= 0),
  urgency           TEXT    NOT NULL CHECK (urgency IN ('NORMAL','URGENT','CRITICAL')),
  status            TEXT    NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','COVERED','COMPLETED','CANCELLED','EXPIRED')),
  note              TEXT,
  is_synthetic      BOOLEAN NOT NULL DEFAULT false,
  scenario_id       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL,
  closed_at         TIMESTAMPTZ,
  UNIQUE (hospital_id, client_request_id)
);
CREATE INDEX IF NOT EXISTS idx_requests_hospital ON requests(hospital_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at);
CREATE INDEX IF NOT EXISTS idx_requests_group_created ON requests(blood_group, component, created_at);
CREATE INDEX IF NOT EXISTS idx_requests_synthetic_created ON requests(is_synthetic, created_at);

CREATE TABLE IF NOT EXISTS request_broadcasts (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id   BIGINT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  bank_id      BIGINT NOT NULL REFERENCES blood_banks(id) ON DELETE CASCADE,
  status       TEXT   NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','VIEWED','CLOSED')),
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id, bank_id)
);
CREATE INDEX IF NOT EXISTS idx_request_broadcasts_bank ON request_broadcasts(bank_id);
CREATE INDEX IF NOT EXISTS idx_request_broadcasts_request ON request_broadcasts(request_id);

-- ---------------------------------------------------------------------------
-- Module 04 — atomic bank allocations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS request_allocations (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id     BIGINT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  bank_id        BIGINT NOT NULL REFERENCES blood_banks(id) ON DELETE CASCADE,
  units_reserved INTEGER NOT NULL CHECK (units_reserved > 0),
  status         TEXT NOT NULL DEFAULT 'RESERVED' CHECK (status IN ('RESERVED','RELEASED','COMPLETED')),
  reserved_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at    TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id, bank_id)
);
CREATE INDEX IF NOT EXISTS idx_request_allocations_request ON request_allocations(request_id);
CREATE INDEX IF NOT EXISTS idx_request_allocations_bank ON request_allocations(bank_id);
CREATE INDEX IF NOT EXISTS idx_request_allocations_status ON request_allocations(status);
DROP TRIGGER IF EXISTS trg_request_allocations_updated_at ON request_allocations;
CREATE TRIGGER trg_request_allocations_updated_at BEFORE UPDATE ON request_allocations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Module 05 — donor profiles + private in-app alerts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS donors (
  id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id                 BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name            TEXT NOT NULL,
  blood_group             TEXT NOT NULL CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  phone_private           TEXT,
  email_private           TEXT,
  city                    TEXT NOT NULL,
  locality                TEXT,
  pin_code                TEXT,
  approx_latitude         DOUBLE PRECISION CHECK (approx_latitude  IS NULL OR (approx_latitude  BETWEEN -90  AND 90)),
  approx_longitude        DOUBLE PRECISION CHECK (approx_longitude IS NULL OR (approx_longitude BETWEEN -180 AND 180)),
  availability_status     TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (availability_status IN ('AVAILABLE','UNAVAILABLE','UNKNOWN')),
  availability_updated_at TIMESTAMPTZ,
  last_donation_date      TIMESTAMPTZ,
  next_contact_after      TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_donors_blood_group ON donors(blood_group);
CREATE INDEX IF NOT EXISTS idx_donors_availability ON donors(availability_status, availability_updated_at);
CREATE INDEX IF NOT EXISTS idx_donors_city ON donors(city);
DROP TRIGGER IF EXISTS trg_donors_updated_at ON donors;
CREATE TRIGGER trg_donors_updated_at BEFORE UPDATE ON donors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS donor_alerts (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  donor_id   BIGINT NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','VIEWED','DISMISSED','CLOSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  viewed_at  TIMESTAMPTZ,
  closed_at  TIMESTAMPTZ,
  UNIQUE (request_id, donor_id)
);
CREATE INDEX IF NOT EXISTS idx_donor_alerts_request ON donor_alerts(request_id);
CREATE INDEX IF NOT EXISTS idx_donor_alerts_donor ON donor_alerts(donor_id);
CREATE INDEX IF NOT EXISTS idx_donor_alerts_status ON donor_alerts(status);

-- ---------------------------------------------------------------------------
-- Module 06 — pledges + temporary live location
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS donor_pledges (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id       BIGINT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  donor_id         BIGINT NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
  alert_id         BIGINT NOT NULL UNIQUE REFERENCES donor_alerts(id) ON DELETE CASCADE,
  public_reference TEXT NOT NULL UNIQUE,
  status           TEXT NOT NULL DEFAULT 'PLEDGED'
                   CHECK (status IN ('PLEDGED','ARRIVED','CANCELLED','DEFERRED','EXPIRED','CLOSED')),
  pledged_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  arrived_at       TIMESTAMPTZ,
  cancelled_at     TIMESTAMPTZ,
  closed_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id, donor_id)
);
CREATE INDEX IF NOT EXISTS idx_donor_pledges_request ON donor_pledges(request_id);
CREATE INDEX IF NOT EXISTS idx_donor_pledges_donor ON donor_pledges(donor_id);
CREATE INDEX IF NOT EXISTS idx_donor_pledges_status ON donor_pledges(status);
DROP TRIGGER IF EXISTS trg_donor_pledges_updated_at ON donor_pledges;
CREATE TRIGGER trg_donor_pledges_updated_at BEFORE UPDATE ON donor_pledges
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS donor_location_sessions (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  donor_id   BIGINT NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
  request_id BIGINT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  pledge_id  BIGINT NOT NULL UNIQUE REFERENCES donor_pledges(id) ON DELETE CASCADE,
  latitude   DOUBLE PRECISION NOT NULL CHECK (latitude  BETWEEN -90  AND 90),
  longitude  DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (donor_id, request_id)
);
CREATE INDEX IF NOT EXISTS idx_location_sessions_request ON donor_location_sessions(request_id);
CREATE INDEX IF NOT EXISTS idx_location_sessions_expiry ON donor_location_sessions(expires_at);
DROP TRIGGER IF EXISTS trg_location_sessions_updated_at ON donor_location_sessions;
CREATE TRIGGER trg_location_sessions_updated_at BEFORE UPDATE ON donor_location_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Module 07 — transactional notification outbox
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recipient_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel           TEXT NOT NULL DEFAULT 'IN_APP' CHECK (channel IN ('IN_APP','EMAIL','TELEGRAM','FCM')),
  event_type        TEXT NOT NULL,
  entity_type       TEXT,
  entity_id         BIGINT,
  dedupe_key        TEXT NOT NULL,
  title             TEXT NOT NULL,
  message           TEXT NOT NULL,
  payload_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
  status            TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','SENT','DELIVERED','ACKNOWLEDGED','FAILED')),
  attempt_count     INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts      INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts >= 1),
  next_attempt_at   TIMESTAMPTZ,
  last_error        TEXT,
  queued_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at           TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  acknowledged_at   TIMESTAMPTZ,
  read_at           TIMESTAMPTZ,
  failed_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (recipient_user_id, channel, dedupe_key)
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_due ON notifications(next_attempt_at) WHERE status = 'QUEUED';
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_user_id, read_at) WHERE read_at IS NULL;
DROP TRIGGER IF EXISTS trg_notifications_updated_at ON notifications;
CREATE TRIGGER trg_notifications_updated_at BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Module 08 — append-only audit log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  entity_type   TEXT,
  entity_id     BIGINT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- Guard: audit_logs is append-only. Block UPDATE / DELETE at the DB layer.
CREATE OR REPLACE FUNCTION audit_logs_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only' USING ERRCODE = 'check_violation';
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_logs_append_only ON audit_logs;
CREATE TRIGGER trg_audit_logs_append_only
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();

-- ---------------------------------------------------------------------------
-- Module 09 — surge detection
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS demand_baselines (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  city           TEXT NOT NULL,
  blood_group    TEXT NOT NULL CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  component      TEXT NOT NULL DEFAULT 'RED_CELLS' CHECK (component = 'RED_CELLS'),
  local_hour     INTEGER NOT NULL CHECK (local_hour BETWEEN 0 AND 23),
  lambda         DOUBLE PRECISION NOT NULL CHECK (lambda >= 0),
  sample_days    INTEGER NOT NULL DEFAULT 0 CHECK (sample_days >= 0),
  request_count  INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  is_synthetic   BOOLEAN NOT NULL DEFAULT false,
  generated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_from     TIMESTAMPTZ,
  valid_to       TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (city, blood_group, component, local_hour, is_synthetic)
);
CREATE INDEX IF NOT EXISTS idx_demand_baselines_lookup
  ON demand_baselines(city, blood_group, component, local_hour, is_synthetic);
DROP TRIGGER IF EXISTS trg_demand_baselines_updated_at ON demand_baselines;
CREATE TRIGGER trg_demand_baselines_updated_at BEFORE UPDATE ON demand_baselines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS surge_candidates (
  id                        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mode                      TEXT NOT NULL DEFAULT 'REAL' CHECK (mode IN ('REAL','DEMO')),
  city                      TEXT NOT NULL,
  blood_group               TEXT NOT NULL CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  component                 TEXT NOT NULL DEFAULT 'RED_CELLS' CHECK (component = 'RED_CELLS'),
  window_started_at         TIMESTAMPTZ NOT NULL,
  window_ended_at           TIMESTAMPTZ NOT NULL,
  observed_request_count    INTEGER NOT NULL CHECK (observed_request_count >= 0),
  expected_lambda           DOUBLE PRECISION NOT NULL CHECK (expected_lambda >= 0),
  poisson_tail_probability  DOUBLE PRECISION NOT NULL,
  distinct_hospital_count   INTEGER NOT NULL DEFAULT 0 CHECK (distinct_hospital_count >= 0),
  velocity_ratio            DOUBLE PRECISION NOT NULL DEFAULT 0,
  previous_window_count     INTEGER NOT NULL DEFAULT 0 CHECK (previous_window_count >= 0),
  geographic_signal         TEXT NOT NULL DEFAULT 'UNAVAILABLE' CHECK (geographic_signal IN ('CONCENTRATED','SPREAD','UNAVAILABLE')),
  geographic_radius_km      DOUBLE PRECISION,
  recorded_inventory_units  INTEGER NOT NULL DEFAULT 0,
  fresh_inventory_rows      INTEGER NOT NULL DEFAULT 0,
  stale_inventory_rows      INTEGER NOT NULL DEFAULT 0,
  inventory_depletion_units INTEGER NOT NULL DEFAULT 0,
  signal_score              INTEGER NOT NULL DEFAULT 0 CHECK (signal_score BETWEEN 0 AND 100),
  baseline_source           TEXT NOT NULL DEFAULT 'SYNTHETIC' CHECK (baseline_source IN ('REAL','SYNTHETIC')),
  status                    TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED','REJECTED','STALE')),
  is_synthetic              BOOLEAN NOT NULL DEFAULT false,
  dedupe_key                TEXT NOT NULL UNIQUE,
  detected_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at               TIMESTAMPTZ,
  reviewed_by_user_id       BIGINT REFERENCES users(id) ON DELETE SET NULL,
  review_note               TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_surge_candidates_status ON surge_candidates(status, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_surge_candidates_group ON surge_candidates(city, blood_group, component);
CREATE INDEX IF NOT EXISTS idx_surge_candidates_dedupe ON surge_candidates(dedupe_key);
DROP TRIGGER IF EXISTS trg_surge_candidates_updated_at ON surge_candidates;
CREATE TRIGGER trg_surge_candidates_updated_at BEFORE UPDATE ON surge_candidates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS surge_events (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  candidate_id         BIGINT NOT NULL UNIQUE REFERENCES surge_candidates(id) ON DELETE CASCADE,
  city                 TEXT NOT NULL,
  blood_group          TEXT NOT NULL,
  component            TEXT NOT NULL DEFAULT 'RED_CELLS',
  status               TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','CLOSED')),
  confirmed_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary              TEXT,
  admin_note           TEXT,
  is_synthetic         BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_surge_events_status ON surge_events(status, confirmed_at DESC);
DROP TRIGGER IF EXISTS trg_surge_events_updated_at ON surge_events;
CREATE TRIGGER trg_surge_events_updated_at BEFORE UPDATE ON surge_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Module 10 — PostgreSQL-backed express-session store
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  sid        TEXT PRIMARY KEY,
  sess       JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
DROP TRIGGER IF EXISTS trg_sessions_updated_at ON sessions;
CREATE TRIGGER trg_sessions_updated_at BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
