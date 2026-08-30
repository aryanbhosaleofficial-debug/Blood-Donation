'use strict';

// Ensure requiring the config singleton does not blow up in the test process.
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-0123456789abcdef';
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildConfig } = require('../src/core/config');

const validEnv = () => ({ SESSION_SECRET: 'x'.repeat(32) });

test('builds config from a valid environment with sensible defaults', () => {
  const cfg = buildConfig(validEnv());
  assert.equal(cfg.nodeEnv, 'development');
  assert.equal(cfg.port, 3000);
  assert.equal(cfg.appOrigin, 'http://localhost:3000');
  assert.equal(cfg.frontendOrigin, 'http://localhost:3000');
  assert.equal(cfg.appTimezone, 'Asia/Kolkata');
  assert.equal(cfg.requestTtlMinutes, 120);
  assert.equal(cfg.dbBusyTimeoutMs, 5000);
  assert.equal(cfg.inventoryMaxUnits, 1000);
  assert.equal(cfg.inventoryStaleMinutes, 30);
  assert.equal(cfg.availabilityFreshnessDays, 7);
  assert.equal(cfg.donorDiscoveryRadiusKm, 25);
  assert.equal(cfg.donorMatchLimit, 50);
  assert.equal(cfg.locationSessionTtlMinutes, 30);
  assert.equal(cfg.etaRoadFactor, 1.3);
  assert.equal(cfg.etaAssumedSpeedKmh, 25);
  assert.equal(cfg.etaPrepBufferMinutes, 5);
  assert.equal(cfg.surge.minimumCount, 5);
  assert.equal(typeof cfg.databasePath, 'string');
  assert.ok(cfg.databasePath.endsWith('app.db'));
});

test('honours overrides and coerces types', () => {
  const cfg = buildConfig({
    ...validEnv(),
    NODE_ENV: 'production',
    PORT: '8080',
    REQUEST_TTL_MINUTES: '45',
    SURGE_PROBABILITY_THRESHOLD: '0.005',
    INVENTORY_MAX_UNITS: '2500',
    INVENTORY_STALE_MINUTES: '45',
    DONOR_DISCOVERY_RADIUS_KM: '40',
    DONOR_MATCH_LIMIT: '25',
    LOCATION_SESSION_TTL_MINUTES: '45',
    ETA_ROAD_FACTOR: '1.5',
    ETA_ASSUMED_SPEED_KMH: '30',
    ETA_PREP_BUFFER_MINUTES: '7',
  });
  assert.equal(cfg.nodeEnv, 'production');
  assert.equal(cfg.isProduction, true);
  assert.equal(cfg.port, 8080);
  assert.equal(cfg.requestTtlMinutes, 45);
  assert.equal(cfg.surge.probabilityThreshold, 0.005);
  assert.equal(cfg.inventoryMaxUnits, 2500);
  assert.equal(cfg.inventoryStaleMinutes, 45);
  assert.equal(cfg.donorDiscoveryRadiusKm, 40);
  assert.equal(cfg.donorMatchLimit, 25);
  assert.equal(cfg.locationSessionTtlMinutes, 45);
  assert.equal(cfg.etaRoadFactor, 1.5);
  assert.equal(cfg.etaAssumedSpeedKmh, 30);
  assert.equal(cfg.etaPrepBufferMinutes, 7);
});

test('fails with a clear error when SESSION_SECRET is missing', () => {
  assert.throws(() => buildConfig({}), (err) => {
    assert.match(err.message, /Invalid application configuration/);
    assert.match(err.message, /SESSION_SECRET/);
    return true;
  });
});

test('rejects the placeholder SESSION_SECRET', () => {
  assert.throws(() => buildConfig({ SESSION_SECRET: 'replace-me' }), /placeholder/);
});

test('rejects a too-short SESSION_SECRET', () => {
  assert.throws(() => buildConfig({ SESSION_SECRET: 'short' }), /at least 16 characters/);
});

test('rejects a non-integer numeric variable', () => {
  assert.throws(() => buildConfig({ ...validEnv(), PORT: 'not-a-number' }), /PORT must be an integer/);
});

test('rejects an unknown timezone', () => {
  assert.throws(
    () => buildConfig({ ...validEnv(), APP_TIMEZONE: 'Mars/Olympus_Mons' }),
    /not a valid IANA timezone/,
  );
});

test('reports every problem at once', () => {
  assert.throws(
    () => buildConfig({ PORT: 'x', NODE_ENV: 'staging' }),
    (err) => {
      assert.match(err.message, /SESSION_SECRET/);
      assert.match(err.message, /PORT/);
      assert.match(err.message, /NODE_ENV/);
      return true;
    },
  );
});
