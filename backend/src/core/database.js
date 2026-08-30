'use strict';

/**
 * core/database
 *
 * Opens the SQLite database, applies the required pragmas, runs the bootstrap
 * schema, and exposes a single shared connection to the rest of the app.
 *
 * Required configuration (see docs/architecture.md section 8):
 *   PRAGMA journal_mode = WAL
 *   PRAGMA foreign_keys = ON
 *   PRAGMA busy_timeout = <configurable>
 */

const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const config = require('./config');
const logger = require('./logger');

const SCHEMA_PATH = path.resolve(__dirname, '..', '..', 'db', 'schema.sql');

/** @type {import('better-sqlite3').Database | null} */
let connection = null;

/**
 * Open a new SQLite connection with all required pragmas applied and the
 * bootstrap schema executed. Exported mainly so tests can open an isolated
 * database file.
 *
 * @param {{ path?: string, busyTimeoutMs?: number }} [options]
 * @returns {import('better-sqlite3').Database}
 */
function openDatabase(options = {}) {
  const filePath = options.path || config.databasePath;
  const busyTimeoutMs = options.busyTimeoutMs ?? config.dbBusyTimeoutMs;

  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma(`busy_timeout = ${busyTimeoutMs}`);

  const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schemaSql);

  return db;
}

/**
 * Return the shared application connection, opening it on first use.
 * @returns {import('better-sqlite3').Database}
 */
function getDb() {
  if (connection === null) {
    connection = openDatabase();
    logger.info('database ready', {
      path: config.databasePath,
      journalMode: connection.pragma('journal_mode', { simple: true }),
      foreignKeys: connection.pragma('foreign_keys', { simple: true }),
    });
  }
  return connection;
}

/**
 * Lightweight liveness check for the health endpoint.
 * @returns {boolean}
 */
function pingDatabase() {
  try {
    const row = getDb().prepare('SELECT 1 AS ok').get();
    return row != null && row.ok === 1;
  } catch (err) {
    logger.error('database ping failed', { message: err.message });
    return false;
  }
}

/** Read the recorded schema version (used by the health endpoint). */
function getSchemaVersion() {
  try {
    const row = getDb().prepare("SELECT value FROM app_meta WHERE key = 'schema_version'").get();
    return row ? row.value : null;
  } catch {
    return null;
  }
}

/** Close the shared connection (used on shutdown and in tests). */
function closeDatabase() {
  if (connection !== null) {
    connection.close();
    connection = null;
  }
}

module.exports = { openDatabase, getDb, pingDatabase, getSchemaVersion, closeDatabase };
