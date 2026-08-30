'use strict';

require('../helpers/env');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { hospitalView, bankView, isPastExpiry } = require('../../src/modules/requests/requests.serializer');

const row = {
  id: 101,
  client_request_id: 'c1',
  hospital_id: 7,
  blood_group: 'O-',
  component: 'RED_CELLS',
  units_needed: 2,
  backup_slots: 0,
  urgency: 'CRITICAL',
  status: 'OPEN',
  note: 'Emergency requirement',
  is_synthetic: 0,
  scenario_id: null,
  created_at: '2026-08-30T10:00:00.000Z',
  expires_at: '2026-08-30T12:00:00.000Z',
  closed_at: null,
  // hospital-name leak candidates that must NOT appear in a bank view:
  h_name: 'City Hospital',
  h_city: 'Pune',
  h_locality: 'Central',
  broadcast_status: 'PENDING',
};

test('hospitalView exposes the documented fields and nothing sensitive', () => {
  const out = hospitalView(row, Date.parse('2026-08-30T11:00:00.000Z'));
  assert.deepEqual(
    Object.keys(out).sort(),
    [
      'id', 'clientRequestId', 'bloodGroup', 'component', 'unitsNeeded', 'backupSlots',
      'urgency', 'status', 'note', 'createdAt', 'expiresAt', 'closedAt', 'isPastExpiry',
      'hospitalId', 'isSynthetic', 'scenarioId',
      'bankUnitsAllocated', 'remainingBankUnits',
    ].sort(),
  );
  assert.equal(out.isPastExpiry, false);
  assert.equal(out.isSynthetic, false);
});

test('bankView adds only coarse facility context, no account/security fields', () => {
  const out = bankView(row);
  assert.deepEqual(out.hospital, { name: 'City Hospital', city: 'Pune', locality: 'Central' });
  const serialized = JSON.stringify(out);
  for (const forbidden of ['password', 'hash', 'user_id', 'userId', 'contact_phone', 'verified_by', 'session', 'csrf']) {
    assert.equal(serialized.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
  }
  assert.equal('hospitalId' in out, false);
  assert.equal('isSynthetic' in out, false);
});

test('isPastExpiry is derived from controlled timestamps, never mutated', () => {
  assert.equal(isPastExpiry(row, Date.parse('2026-08-30T11:59:59.000Z')), false);
  assert.equal(isPastExpiry(row, Date.parse('2026-08-30T12:00:01.000Z')), true);
});

test('serializers tolerate null input', () => {
  assert.equal(hospitalView(null), null);
  assert.equal(bankView(undefined), null);
});
