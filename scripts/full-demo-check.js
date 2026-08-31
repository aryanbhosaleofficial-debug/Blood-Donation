#!/usr/bin/env node
'use strict';

/**
 * scripts/full-demo-check.js
 *
 *   npm run demo:check
 *
 * Non-destructive. Runs the demo readiness check (scripts/verify-demo.js) and
 * additionally reports whether a production frontend build artefact exists.
 * Exit 0 = READY, non-zero otherwise.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

const verify = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'verify-demo.js')], { stdio: 'inherit' });

const distIndex = path.join(ROOT, 'frontend', 'dist', 'index.html');
const builtAssets = fs.existsSync(path.join(ROOT, 'frontend', 'dist', 'assets'));
const frontendBuilt = fs.existsSync(distIndex) && builtAssets;
console.log(`  Frontend build artefact       : ${frontendBuilt ? 'PRESENT' : 'MISSING (run: npm run build:frontend)'}`);

const ok = verify.status === 0 && frontendBuilt;
console.log(`\nOVERALL: ${ok ? 'READY FOR DEMO' : 'NOT READY'}\n`);
process.exit(ok ? 0 : 1);
