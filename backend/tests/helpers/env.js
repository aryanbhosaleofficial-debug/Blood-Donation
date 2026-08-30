'use strict';

/**
 * Test environment bootstrap. Require this FIRST in every test file, before any
 * `require` that pulls in core/config:
 *
 *   require('../helpers/env');
 *
 * Node's test runner isolates each test file in its own process, so a
 * per-process temp directory + one memoized DB connection is safe.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbdms-test-'));

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-session-secret-abcdefghijklmnop';
process.env.APP_ORIGIN = 'http://localhost:3000';
process.env.DATABASE_PATH = path.join(dir, 'app.db');
process.env.SESSION_DATABASE_PATH = path.join(dir, 'sessions.db');
process.env.BCRYPT_ROUNDS = '4'; // fast hashing for tests
process.env.LOGIN_MAX_ATTEMPTS = '5';
process.env.LOGIN_LOCK_MINUTES = '15';
// Default: don't trip the IP limiter in tests. A test file may pin its own
// value by setting this before requiring this helper.
process.env.LOGIN_RATE_LIMIT_MAX = process.env.LOGIN_RATE_LIMIT_MAX || '10000';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';

module.exports = { testDir: dir, appOrigin: process.env.APP_ORIGIN };
