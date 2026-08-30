'use strict';

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-0123456789abcdef';
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { openDatabase } = require('../src/core/database');

function tempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbdms-db-'));
  return path.join(dir, 'app.db');
}

test('a fresh connection has foreign_keys = ON', () => {
  const db = openDatabase({ path: tempDbPath() });
  try {
    assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
  } finally {
    db.close();
  }
});

test('a fresh connection has journal_mode = WAL', () => {
  const db = openDatabase({ path: tempDbPath() });
  try {
    assert.equal(String(db.pragma('journal_mode', { simple: true })).toLowerCase(), 'wal');
  } finally {
    db.close();
  }
});

test('busy_timeout is applied', () => {
  const db = openDatabase({ path: tempDbPath(), busyTimeoutMs: 7000 });
  try {
    assert.equal(db.pragma('busy_timeout', { simple: true }), 7000);
  } finally {
    db.close();
  }
});

test('the bootstrap schema runs and is idempotent', () => {
  const dbPath = tempDbPath();
  let db = openDatabase({ path: dbPath });
  const version = db.prepare("SELECT value FROM app_meta WHERE key = 'schema_version'").get();
  assert.equal(version.value, '2');
  db.close();

  // Re-opening the same file must not fail (schema.sql is idempotent).
  db = openDatabase({ path: dbPath });
  try {
    const count = db.prepare('SELECT COUNT(*) AS n FROM app_meta').get();
    assert.ok(count.n >= 1);
  } finally {
    db.close();
  }
});

test('the database file is created on disk', () => {
  const dbPath = tempDbPath();
  const db = openDatabase({ path: dbPath });
  try {
    assert.ok(fs.existsSync(dbPath));
  } finally {
    db.close();
  }
});
