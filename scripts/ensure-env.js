#!/usr/bin/env node
'use strict';

/**
 * Ensures a usable `.env` exists before the app starts.
 *
 * On a clean checkout there is no `.env` (it is git-ignored). This script
 * copies `.env.example` to `.env` and fills in a freshly generated
 * SESSION_SECRET so `npm start` works with a single command.
 *
 * It never overwrites an existing `.env`.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const envPath = path.join(ROOT, '.env');
const examplePath = path.join(ROOT, '.env.example');

if (fs.existsSync(envPath)) {
  process.exit(0);
}

if (!fs.existsSync(examplePath)) {
  console.error('[ensure-env] .env.example is missing; cannot bootstrap .env');
  process.exit(1);
}

const generatedSecret = crypto.randomBytes(48).toString('hex');
const contents = fs
  .readFileSync(examplePath, 'utf8')
  .replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${generatedSecret}`);

fs.writeFileSync(envPath, contents, { mode: 0o600 });
console.log('[ensure-env] created .env from .env.example with a generated SESSION_SECRET');
