'use strict';

require('../helpers/env'); // REQUEST_MAX_UNITS default (20) is used by the schema

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { createRequestSchema } = require('../../src/modules/requests/requests.schemas');

const base = () => ({
  clientRequestId: crypto.randomUUID(),
  bloodGroup: 'O-',
  component: 'RED_CELLS',
  unitsNeeded: 2,
  urgency: 'CRITICAL',
});

const rejects = (patch, label) =>
  test(`rejects: ${label}`, () => {
    assert.equal(createRequestSchema.safeParse({ ...base(), ...patch }).success, false);
  });

test('accepts a well-formed payload', () => {
  assert.equal(createRequestSchema.safeParse(base()).success, true);
});

rejects({ clientRequestId: 'not-a-uuid' }, 'invalid UUID');
rejects({ clientRequestId: '12345' }, 'numeric client id');
rejects({ bloodGroup: 'Z+' }, 'invalid blood group');
rejects({ bloodGroup: 'o-' }, 'wrong-case blood group');
rejects({ component: 'PLASMA' }, 'unsupported component PLASMA');
rejects({ component: 'PLATELETS' }, 'unsupported component PLATELETS');
rejects({ unitsNeeded: 0 }, 'units = 0');
rejects({ unitsNeeded: -3 }, 'negative units');
rejects({ unitsNeeded: 1.5 }, 'fractional units');
rejects({ unitsNeeded: 21 }, 'units above REQUEST_MAX_UNITS');
rejects({ unitsNeeded: '2' }, 'stringified units');
rejects({ urgency: 'SUPER_CRITICAL' }, 'invalid urgency');
rejects({ note: 'x'.repeat(501) }, 'note too long');
rejects({ isSynthetic: true }, 'protected field isSynthetic (strict schema)');
rejects({ scenarioId: 'demo' }, 'protected field scenarioId (strict schema)');
rejects({ hospitalId: 1 }, 'protected field hospitalId (strict schema)');
rejects({ status: 'COVERED' }, 'protected field status (strict schema)');
rejects({ expiresAt: '2030-01-01' }, 'protected field expiresAt (strict schema)');

test('note at the 500-char limit is accepted and trimmed', () => {
  const parsed = createRequestSchema.safeParse({ ...base(), note: `  ${'n'.repeat(498)}  ` });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.note.length, 498);
});
