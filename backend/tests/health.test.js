'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

// Configure the app for an isolated test database BEFORE requiring it.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbdms-health-'));
process.env.SESSION_SECRET = 'test-secret-0123456789abcdef';
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tmpDir, 'app.db');

const test = require('node:test');
const assert = require('node:assert/strict');

const { createApp } = require('../src/app');
const { closeDatabase } = require('../src/core/database');

async function withServer(run) {
  const server = createApp().listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

test.after(() => closeDatabase());

test('GET /api/health returns 200 with status ok and a live db', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.data.status, 'ok');
    assert.equal(body.data.db, 'ok');
    assert.equal(body.data.schemaVersion, '1');
    assert.ok(body.data.timestamp);
  });
});

test('unknown API routes return a JSON 404 in the standard error shape', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/does-not-exist`);
    assert.equal(res.status, 404);

    const body = await res.json();
    assert.equal(body.error.code, 'NOT_FOUND');
    assert.equal(typeof body.error.message, 'string');
  });
});

test('the frontend index.html is served from /', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.match(text, /Community Blood Donation Matching System/);
  });
});
