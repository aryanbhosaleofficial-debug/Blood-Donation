'use strict';

/**
 * core/logger
 *
 * Minimal structured logger (one JSON object per line).
 *
 * Safety: it redacts sensitive values by key name before writing, so that
 * passwords, session secrets, session cookie values, CSRF tokens and exact
 * donor coordinates never reach the logs even if they are accidentally passed
 * in a metadata object.
 */

const config = require('./config');

const LEVEL_WEIGHT = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };
const activeWeight = LEVEL_WEIGHT[config.logLevel] ?? LEVEL_WEIGHT.info;

// Compared case-insensitively against object keys.
const REDACT_KEYS = new Set([
  'password',
  'passwd',
  'pwd',
  'passwordhash',
  'password_hash',
  'newpassword',
  'currentpassword',
  'secret',
  'session_secret',
  'sessionsecret',
  'token',
  'accesstoken',
  'refreshtoken',
  'csrf',
  'csrftoken',
  'csrf_token',
  'x-csrf-token',
  '_csrf',
  'authorization',
  'cookie',
  'set-cookie',
  'session',
  'sessionid',
  'session_id',
  'sid',
  'connect.sid',
  'blood.sid',
  'apikey',
  'api_key',
  'lat',
  'lng',
  'lon',
  'latitude',
  'longitude',
  'coords',
  'coordinates',
  'approx_latitude',
  'approx_longitude',
  'phone',
  'phone_private',
  'email_private',
]);

// Substring matches (lower-cased) that also trigger redaction, so variants like
// "userPassword" or "xCsrfToken" are caught even if not listed explicitly.
const REDACT_SUBSTRINGS = ['password', 'secret', 'csrf', 'cookie'];

function shouldRedact(key) {
  const lower = key.toLowerCase();
  if (REDACT_KEYS.has(lower)) return true;
  return REDACT_SUBSTRINGS.some((needle) => lower.includes(needle));
}

const REDACTED = '[REDACTED]';
const MAX_DEPTH = 6;

function redact(value, depth = 0) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (depth >= MAX_DEPTH) {
    return '[Truncated]';
  }
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = shouldRedact(key) ? REDACTED : redact(val, depth + 1);
  }
  return out;
}

function write(level, message, meta) {
  if (LEVEL_WEIGHT[level] > activeWeight) {
    return;
  }
  const entry = {
    time: new Date().toISOString(),
    level,
    message: String(message),
  };
  if (meta !== undefined) {
    entry.meta = redact(meta);
  }
  const line = `${JSON.stringify(entry)}\n`;
  if (level === 'error' || level === 'warn') {
    process.stderr.write(line);
  } else {
    process.stdout.write(line);
  }
}

module.exports = {
  error: (message, meta) => write('error', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  info: (message, meta) => write('info', message, meta),
  debug: (message, meta) => write('debug', message, meta),
  redact,
};
