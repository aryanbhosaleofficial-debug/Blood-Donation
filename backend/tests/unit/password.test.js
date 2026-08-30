'use strict';

require('../helpers/env');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  hashPassword,
  verifyPassword,
  assertPasswordPolicy,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_BYTES,
} = require('../../src/security/password');

test('hashing produces a bcrypt hash, not the plaintext', async () => {
  const password = 'correct horse battery';
  const hash = await hashPassword(password);
  assert.notEqual(hash, password);
  assert.match(hash, /^\$2[aby]\$\d{2}\$/);
});

test('a valid password verifies against its hash', async () => {
  const hash = await hashPassword('correct horse battery');
  assert.equal(await verifyPassword('correct horse battery', hash), true);
});

test('a wrong password fails verification', async () => {
  const hash = await hashPassword('correct horse battery');
  assert.equal(await verifyPassword('wrong horse battery!!', hash), false);
});

test('verifyPassword returns false (never throws) for a malformed hash', async () => {
  assert.equal(await verifyPassword('whatever-value', 'not-a-real-hash'), false);
  assert.equal(await verifyPassword('whatever-value', ''), false);
});

test('the minimum length is enforced', () => {
  assert.throws(() => assertPasswordPolicy('short'), /at least 12 characters/);
  assert.equal(PASSWORD_MIN_LENGTH, 12);
});

test('oversized input is rejected by policy and by hashing', async () => {
  const huge = 'a'.repeat(PASSWORD_MAX_BYTES + 1);
  assert.throws(() => assertPasswordPolicy(huge), /at most 72 bytes/);
  await assert.rejects(() => hashPassword(huge), /at most 72 bytes/);
});

test('oversized input verifies as false rather than truncating', async () => {
  const hash = await hashPassword('a'.repeat(PASSWORD_MAX_BYTES));
  assert.equal(await verifyPassword('a'.repeat(PASSWORD_MAX_BYTES + 5), hash), false);
});
