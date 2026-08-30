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

    requestTtlMinutes: integer('REQUEST_TTL_MINUTES', 120),
    locationSessionTtlMinutes: integer('LOCATION_SESSION_TTL_MINUTES', 30),
    availabilityFreshnessDays: integer('AVAILABILITY_FRESHNESS_DAYS', 7),
    notificationMaxAttempts: integer('NOTIFICATION_MAX_ATTEMPTS', 3),
    pollIntervalMs: integer('POLL_INTERVAL_MS', 3000),

    surge: {
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
