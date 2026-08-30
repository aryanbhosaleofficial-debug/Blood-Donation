'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const test = require('node:test');
const assert = require('node:assert/strict');

const SERVER = path.resolve(__dirname, '..', 'src', 'server.js');

function runServer(extraEnv, { killAfterMs = 1500 } = {}) {
  return spawnSync(process.execPath, [SERVER], {
    encoding: 'utf8',
    timeout: killAfterMs,
    killSignal: 'SIGINT',
    env: { ...process.env, ...extraEnv },
  });
}

test('app starts cleanly with a valid configuration', () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cbdms-start-')), 'app.db');
  const result = runServer({
    SESSION_SECRET: 'valid-secret-0123456789abcdef',
    NODE_ENV: 'test',
    LOG_LEVEL: 'info',
    PORT: '0',
    DATABASE_PATH: dbPath,
  });

  // The process is killed by the timeout (SIGINT) because a healthy server
  // keeps listening. That means it started without crashing.
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, /server listening/);
  assert.doesNotMatch(output, /Configuration error/);
  assert.ok(fs.existsSync(dbPath), 'database file should be created on first run');
});

test('app fails fast with a clear error when SESSION_SECRET is missing', () => {
  const result = runServer({ SESSION_SECRET: '', NODE_ENV: 'test', PORT: '0' });

  assert.equal(result.status, 1, 'process should exit with code 1');
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, /Configuration error/);
  assert.match(output, /SESSION_SECRET/);
});
