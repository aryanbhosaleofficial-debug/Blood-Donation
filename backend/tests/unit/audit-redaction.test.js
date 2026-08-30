'use strict';

/**
 * tests/unit/audit-redaction.test.js
 *
 * Module 08 — Test Group AH (audit secret redaction).
 * The audit sanitizer must never let secrets or exact donor coordinates
 * reach persisted metadata.
 */

require('../helpers/env');

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isForbiddenKey,
  sanitizeMetadata,
  safeMetadata,
  assertSafeMetadata,
} = require('../../src/modules/audit/audit.sanitizer');

test('isForbiddenKey flags secrets, contact details, and coordinates', () => {
  for (const key of ['password', 'password_hash', 'csrfToken', 'sessionId', 'cookie',
    'authorization', 'latitude', 'longitude', 'lat', 'lng', 'donorPhone', 'email_private']) {
    assert.equal(isForbiddenKey(key), true, `${key} should be forbidden`);
  }
});

test('isForbiddenKey allows ordinary domain keys', () => {
  for (const key of ['requestId', 'statusFrom', 'statusTo', 'bloodGroup', 'previousUnits',
    'newUnits', 'urgency', 'role', 'allocationId', 'bankId']) {
    assert.equal(isForbiddenKey(key), false, `${key} should be allowed`);
  }
});

test('sanitizeMetadata drops forbidden keys recursively and does not mutate input', () => {
  const input = {
    requestId: 101,
    password: 'hunter2',
    donor: { phone: '+91 90000 00000', email: 'a@b.com', city: 'Pune' },
    coords: [18.5, 73.8],
    nested: [{ csrfToken: 'abc', ok: 1 }],
  };
  const { clean, redactedKeys } = sanitizeMetadata(input);

  assert.equal(clean.requestId, 101);
  assert.ok(!('password' in clean));
  assert.ok(!('phone' in clean.donor));
  assert.ok(!('email' in clean.donor));
  assert.equal(clean.donor.city, 'Pune');
  assert.ok(!('coords' in clean));
  assert.ok(!('csrfToken' in clean.nested[0]));
  assert.equal(clean.nested[0].ok, 1);

  // original untouched
  assert.equal(input.password, 'hunter2');
  assert.ok(redactedKeys.includes('password'));
  assert.ok(redactedKeys.includes('phone'));
  assert.ok(redactedKeys.includes('coords'));
});

test('safeMetadata never returns a string containing the raw secret value', () => {
  const clean = safeMetadata({ password: 'S3cr3t!', latitude: 18.52, requestId: 7 });
  const serialized = JSON.stringify(clean);
  assert.ok(!serialized.includes('S3cr3t!'));
  assert.ok(!serialized.includes('18.52'));
  assert.ok(serialized.includes('"requestId":7'));
});

test('assertSafeMetadata throws on forbidden keys, passes on clean metadata', () => {
  assert.throws(() => assertSafeMetadata({ sessionId: 'x' }), /forbidden/);
  assert.doesNotThrow(() => assertSafeMetadata({ requestId: 1, statusTo: 'EXPIRED' }));
});
