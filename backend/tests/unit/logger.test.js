'use strict';

process.env.LOG_LEVEL = 'debug'; // ensure the logger actually emits
require('../helpers/env');

const test = require('node:test');
const assert = require('node:assert/strict');

const logger = require('../../src/core/logger');

function captureStdout(fn) {
  const chunks = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk, ...rest) => {
    chunks.push(String(chunk));
    return true;
  };
  try {
    fn();
  } finally {
    process.stdout.write = original;
  }
  return chunks.join('');
}

test('redact() recursively masks sensitive keys and keeps safe ones', () => {
  const out = logger.redact({
    password: 'secret',
    passwordHash: 'secret',
    password_hash: 'secret',
    csrfToken: 'secret',
    authorization: 'Bearer secret',
    cookie: 'blood.sid=abc',
    secret: 'secret',
    nested: {
      sessionId: 'secret',
      latitude: 12.34,
      longitude: 56.78,
      lat: 1,
      lng: 2,
    },
    list: [{ token: 'secret' }],
    safeValue: 'visible',
    email: 'user@example.com',
  });

  assert.equal(out.password, '[REDACTED]');
  assert.equal(out.passwordHash, '[REDACTED]');
  assert.equal(out.password_hash, '[REDACTED]');
  assert.equal(out.csrfToken, '[REDACTED]');
  assert.equal(out.authorization, '[REDACTED]');
  assert.equal(out.cookie, '[REDACTED]');
  assert.equal(out.secret, '[REDACTED]');
  assert.equal(out.nested.sessionId, '[REDACTED]');
  assert.equal(out.nested.latitude, '[REDACTED]');
  assert.equal(out.nested.longitude, '[REDACTED]');
  assert.equal(out.nested.lat, '[REDACTED]');
  assert.equal(out.nested.lng, '[REDACTED]');
  assert.equal(out.list[0].token, '[REDACTED]');
  assert.equal(out.safeValue, 'visible');
  assert.equal(out.email, 'user@example.com');
});

test('emitted log lines contain no sensitive values', () => {
  const output = captureStdout(() => {
    logger.info('login attempt', {
      password: 'hunter2plaintext',
      csrfToken: 'csrf-abc-123',
      sessionId: 'sess-xyz-789',
      cookie: 'blood.sid=deadbeef',
      authorization: 'Bearer topsecrettoken',
      secret: 'my-app-secret',
      coords: { latitude: 19.07, longitude: 72.87 },
      user: { email: 'donor@example.com', role: 'DONOR' },
    });
  });

  for (const leak of [
    'hunter2plaintext',
    'csrf-abc-123',
    'sess-xyz-789',
    'deadbeef',
    'topsecrettoken',
    'my-app-secret',
    '19.07',
    '72.87',
  ]) {
    assert.ok(!output.includes(leak), `log output leaked "${leak}"`);
  }
  assert.ok(output.includes('donor@example.com'));
  assert.ok(output.includes('[REDACTED]'));
});
