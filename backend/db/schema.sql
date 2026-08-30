-- Community Blood Donation Matching System
-- Phase 0 bootstrap schema.
--
-- No domain tables yet. Hospitals, blood banks, donors, requests, inventory,
-- allocations, pledges, notifications, audit logs, and surge tables are added
-- in later phases (see docs/modules.md).
--
-- This file is executed on every startup and must be idempotent.

PRAGMA foreign_keys = ON;

-- Simple key/value table so the application always has a table to query for
-- its database connectivity check, and a place to record the schema version.
CREATE TABLE IF NOT EXISTS app_meta (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO app_meta (key, value)
VALUES ('schema_version', '0')
ON CONFLICT(key) DO NOTHING;

INSERT INTO app_meta (key, value)
VALUES ('bootstrapped_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(key) DO NOTHING;
