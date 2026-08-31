'use strict';

/**
 * core/config
 *
 * The single place in the application that reads `process.env`.
 *
 * - Loads `.env` from the repository root (once).
 * - Validates required configuration and fails fast with a readable message
 *   listing every problem it found.
 * - Exposes typed, frozen configuration values.
 *
 * Every other module imports this one and reads `config.<value>` - it must
 * never touch `process.env` itself.
 */

const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..', '..', '..');

// Load .env from the repo root regardless of the process working directory.
// dotenv never overrides variables that are already set in the environment.
require('dotenv').config({ path: path.join(ROOT_DIR, '.env') });

const VALID_NODE_ENVS = ['development', 'test', 'production'];
const VALID_LOG_LEVELS = ['silent', 'error', 'warn', 'info', 'debug'];

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function resolvePath(root, value) {
  return path.isAbsolute(value) ? value : path.resolve(root, value);
}

/**
 * Build a validated configuration object from a plain environment map.
 * Pure and side-effect free so it can be unit tested directly.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {Readonly<object>}
 */
function buildConfig(env) {
  const errors = [];

  const required = (key) => {
    if (isBlank(env[key])) {
      errors.push(`Missing required environment variable: ${key}`);
      return undefined;
    }
    return String(env[key]).trim();
  };

  const string = (key, fallback) => (isBlank(env[key]) ? fallback : String(env[key]).trim());

  const integer = (key, fallback) => {
    if (isBlank(env[key])) return fallback;
    const raw = String(env[key]).trim();
    const parsed = Number(raw);
    if (!Number.isInteger(parsed)) {
      errors.push(`Environment variable ${key} must be an integer (received "${raw}")`);
      return fallback;
    }
    return parsed;
  };

  const float = (key, fallback) => {
    if (isBlank(env[key])) return fallback;
    const raw = String(env[key]).trim();
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      errors.push(`Environment variable ${key} must be a number (received "${raw}")`);
      return fallback;
    }
    return parsed;
  };

  const boolean = (key, fallback) => {
    if (isBlank(env[key])) return fallback;
    const raw = String(env[key]).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
    if (['0', 'false', 'no', 'off'].includes(raw)) return false;
    errors.push(`Environment variable ${key} must be a boolean (received "${raw}")`);
    return fallback;
  };

  const integerInRange = (key, fallback, min, max) => {
    const value = integer(key, fallback);
    if (value < min || value > max) {
      errors.push(`Environment variable ${key} must be between ${min} and ${max} (received "${value}")`);
      return fallback;
    }
    return value;
  };

  const floatInRange = (key, fallback, min, max) => {
    const value = float(key, fallback);
    if (value < min || value > max) {
      errors.push(`Environment variable ${key} must be between ${min} and ${max} (received "${value}")`);
      return fallback;
    }
    return value;
  };

  const oneOf = (key, fallback, allowed) => {
    const value = string(key, fallback);
    if (!allowed.includes(value)) {
      errors.push(`Environment variable ${key} must be one of: ${allowed.join(', ')} (received "${value}")`);
      return fallback;
    }
    return value;
  };

  const nodeEnv = oneOf('NODE_ENV', 'development', VALID_NODE_ENVS);
  const isProduction = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';

  const sessionSecret = required('SESSION_SECRET');
  if (sessionSecret !== undefined) {
    if (/^replace[-_]/i.test(sessionSecret) || sessionSecret === 'replace-me') {
      errors.push('SESSION_SECRET is still set to a placeholder value - set a real random secret');
    } else if (sessionSecret.length < 16) {
      errors.push('SESSION_SECRET must be at least 16 characters long');
    }
  }

  const appTimezone = string('APP_TIMEZONE', 'Asia/Kolkata');
  try {
    // Throws a RangeError for an unknown IANA timezone.
    new Intl.DateTimeFormat('en-US', { timeZone: appTimezone });
  } catch {
    errors.push(`Environment variable APP_TIMEZONE is not a valid IANA timezone (received "${appTimezone}")`);
  }

  const config = {
    rootDir: ROOT_DIR,

    nodeEnv,
    isProduction,
    isTest,

    port: integer('PORT', 3000),
    appOrigin: string('APP_ORIGIN', 'http://localhost:3000'),
    frontendOrigin: string('FRONTEND_ORIGIN', string('APP_ORIGIN', 'http://localhost:3000')),
    appTimezone,
    logLevel: oneOf('LOG_LEVEL', isTest ? 'silent' : 'info', VALID_LOG_LEVELS),

    sessionSecret,
    sessionMaxAgeHours: integer('SESSION_MAX_AGE_HOURS', 4),
    trustProxy: boolean('TRUST_PROXY', false),
    jsonBodyLimit: string('JSON_BODY_LIMIT', '100kb'),

    bcryptRounds: integerInRange('BCRYPT_ROUNDS', 12, 4, 15),

    login: {
      maxAttempts: integer('LOGIN_MAX_ATTEMPTS', 5),
      lockMinutes: integer('LOGIN_LOCK_MINUTES', 15),
      rateLimitWindowMinutes: integer('LOGIN_RATE_LIMIT_WINDOW_MINUTES', 15),
      rateLimitMax: integer('LOGIN_RATE_LIMIT_MAX', 50),
    },

    databasePath: resolvePath(ROOT_DIR, string('DATABASE_PATH', './data/app.db')),
    sessionDatabasePath: resolvePath(ROOT_DIR, string('SESSION_DATABASE_PATH', './data/sessions.db')),
    dbBusyTimeoutMs: integer('DB_BUSY_TIMEOUT_MS', 5000),

    // Module 10 — local demo/viva provisioning only. NOT a production credential.
    // Used by scripts/seed-demo.js and scripts/reset-demo.js to create the
    // deterministic demo accounts. Reset scripts refuse to run when
    // NODE_ENV === 'production'.
    demoPassword: string('DEMO_PASSWORD', 'demo-Passphrase-2024'),
    backupDir: resolvePath(ROOT_DIR, string('BACKUP_DIR', './data/backups')),

    inventoryMaxUnits: integerInRange('INVENTORY_MAX_UNITS', 1000, 1, 1000000),
    inventoryStaleMinutes: integerInRange('INVENTORY_STALE_MINUTES', 30, 1, 525600),

    requestTtlMinutes: integer('REQUEST_TTL_MINUTES', 120),
    requestMaxUnits: integerInRange('REQUEST_MAX_UNITS', 20, 1, 100000),
    requestBackupSlotsDefault: integerInRange('REQUEST_BACKUP_SLOTS_DEFAULT', 0, 0, 100),
    locationSessionTtlMinutes: integerInRange('LOCATION_SESSION_TTL_MINUTES', 30, 1, 1440),
    availabilityFreshnessDays: integerInRange('AVAILABILITY_FRESHNESS_DAYS', 7, 1, 3650),
    donorDiscoveryRadiusKm: integerInRange('DONOR_DISCOVERY_RADIUS_KM', 25, 1, 1000),
    donorMatchLimit: integerInRange('DONOR_MATCH_LIMIT', 50, 1, 1000),
    etaRoadFactor: floatInRange('ETA_ROAD_FACTOR', 1.3, 1, 5),
    etaAssumedSpeedKmh: floatInRange('ETA_ASSUMED_SPEED_KMH', 25, 1, 200),
    etaPrepBufferMinutes: floatInRange('ETA_PREP_BUFFER_MINUTES', 5, 0, 120),
    notificationMaxAttempts: integer('NOTIFICATION_MAX_ATTEMPTS', 3),
    notificationWorkerIntervalMs: integer('NOTIFICATION_WORKER_INTERVAL_MS', 1000),
    notificationWorkerBatchSize: integerInRange('NOTIFICATION_WORKER_BATCH_SIZE', 25, 1, 1000),
    notificationRetryBaseMs: integer('NOTIFICATION_RETRY_BASE_MS', 5000),
    pollIntervalMs: integer('POLL_INTERVAL_MS', 3000),

    // Module 08 — Cleanup job configuration
    requestExpiryJobIntervalMs: integer('REQUEST_EXPIRY_JOB_INTERVAL_MS', 60000),
    requestExpiryBatchSize: integerInRange('REQUEST_EXPIRY_BATCH_SIZE', 50, 1, 500),
    locationCleanupIntervalMs: integer('LOCATION_CLEANUP_INTERVAL_MS', 60000),
    locationCleanupBatchSize: integerInRange('LOCATION_CLEANUP_BATCH_SIZE', 100, 1, 1000),

    // Module 09 — Surge detection (unusual blood-demand pattern detection;
    // NOT disaster prediction). All thresholds are prototype values and are
    // not clinically validated.
    surge: {
      detectorIntervalMs: integer('SURGE_DETECTOR_INTERVAL_MS', 60000),
      analysisWindowMinutes: integerInRange('SURGE_ANALYSIS_WINDOW_MINUTES', 60, 1, 1440),
      pValueThreshold: floatInRange('SURGE_P_VALUE_THRESHOLD', 0.01, 0, 1),
      minRequestCount: integerInRange('SURGE_MIN_REQUEST_COUNT', 5, 1, 100000),
      minDistinctHospitals: integerInRange('SURGE_MIN_DISTINCT_HOSPITALS', 2, 1, 100000),
      geoRadiusKm: floatInRange('SURGE_GEO_RADIUS_KM', 15, 0.1, 100000),
      minBaselineDays: integerInRange('SURGE_MIN_BASELINE_DAYS', 7, 1, 3650),
      baselineRefreshIntervalMs: integer('SURGE_BASELINE_REFRESH_INTERVAL_MS', 21600000),
      scoreConfirmationHint: integerInRange('SURGE_SCORE_CONFIRMATION_HINT', 70, 0, 100),
      // Legacy Module 08 scaffold keys — kept so older .env files stay valid.
      probabilityThreshold: float('SURGE_PROBABILITY_THRESHOLD', 0.01),
      minimumCount: integer('SURGE_MINIMUM_COUNT', 5),
      level2Score: integer('SURGE_LEVEL2_SCORE', 40),
      level3Score: integer('SURGE_LEVEL3_SCORE', 70),
    },
  };

  if (errors.length > 0) {
    throw new Error(
      `Invalid application configuration:\n  - ${errors.join('\n  - ')}\n\n` +
        'Check your .env file against .env.example.',
    );
  }

  Object.freeze(config.surge);
  Object.freeze(config.login);
  return config;
}

// Singleton built from the real environment. Requiring this module in an app
// context (server start) will throw immediately if configuration is invalid.
const config = buildConfig(process.env);
config.buildConfig = buildConfig;

module.exports = Object.freeze(config);
