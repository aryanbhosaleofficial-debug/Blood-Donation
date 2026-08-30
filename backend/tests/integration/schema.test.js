'use strict';

require('../helpers/env');

const { test, after } = require('node:test');
const assert = require('node:assert/strict');

const { getDb, closeDatabase } = require('../../src/core/database');
const { hashPassword } = require('../../src/security/password');

after(() => closeDatabase());

async function hash() {
  return hashPassword('a-valid-password-here');
}

test('01.01: users table exists with the expected columns', () => {
  const cols = getDb().prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  for (const expected of [
    'id',
    'email',
    'password_hash',
    'role',
    'is_verified',
    'is_active',
    'failed_login_attempts',
    'locked_until',
    'created_at',
    'updated_at',
  ]) {
    assert.ok(cols.includes(expected), `missing column: ${expected}`);
  }
});

test('01.01: email is unique', async () => {
  const db = getDb();
  const h = await hash();
  db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)').run('dup@example.com', h, 'DONOR');
  assert.throws(
    () => db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)').run('dup@example.com', h, 'DONOR'),
    /UNIQUE/i,
  );
});

test('01.01: role is constrained by a CHECK', async () => {
  const db = getDb();
  const h = await hash();
  assert.throws(
    () => db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)').run('badrole@example.com', h, 'SUPERUSER'),
    /CHECK/i,
  );
});

test('01.01: is_verified / is_active are boolean-constrained', async () => {
  const db = getDb();
  const h = await hash();
  assert.throws(
    () => db.prepare('INSERT INTO users (email, password_hash, role, is_verified) VALUES (?, ?, ?, ?)').run('bv@example.com', h, 'DONOR', 2),
    /CHECK/i,
  );
  assert.throws(
    () => db.prepare('INSERT INTO users (email, password_hash, role, is_active) VALUES (?, ?, ?, ?)').run('ba@example.com', h, 'DONOR', -1),
    /CHECK/i,
  );
});

test('01.01: failed_login_attempts cannot go negative', async () => {
  const db = getDb();
  const h = await hash();
  assert.throws(
    () => db.prepare('INSERT INTO users (email, password_hash, role, failed_login_attempts) VALUES (?, ?, ?, ?)').run('neg@example.com', h, 'DONOR', -1),
    /CHECK/i,
  );
});

test('01.01: updated_at trigger bumps on UPDATE', async () => {
  const db = getDb();
  const h = await hash();
  const info = db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)').run('trg@example.com', h, 'DONOR');
  db.prepare("UPDATE users SET updated_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").run(info.lastInsertRowid);
  const after = db.prepare('SELECT updated_at FROM users WHERE id = ?').get(info.lastInsertRowid);
  // The trigger overwrites whatever we tried to set.
  assert.notEqual(after.updated_at, '2000-01-01T00:00:00.000Z');
  assert.match(after.updated_at, /^20\d\d-/);
});

test('02: organization and inventory tables expose required constraints', () => {
  const db = getDb();
  for (const table of ['hospitals', 'blood_banks', 'inventory', 'inventory_adjustments']) {
    assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table), table);
  }
  const inventorySql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='inventory'").get().sql;
  assert.match(inventorySql, /component\s*=\s*'RED_CELLS'/i);
  assert.match(inventorySql, /units_available\)\s*=\s*'integer'/i);
  assert.match(inventorySql, /UNIQUE\s*\(bank_id,\s*blood_group,\s*component\)/i);
});

test('N: schema bootstrap is idempotent (re-open the same file)', () => {
  // getDb() already ran the schema once; open a second connection to the same
  // file to prove CREATE ... IF NOT EXISTS + upsert do not error.
  const { openDatabase } = require('../../src/core/database');
  const second = openDatabase({ path: process.env.DATABASE_PATH });
  try {
    assert.equal(second.prepare("SELECT value FROM app_meta WHERE key='schema_version'").get().value, '2');
  } finally {
    second.close();
  }
});
