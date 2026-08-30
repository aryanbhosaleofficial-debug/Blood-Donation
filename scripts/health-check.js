#!/usr/bin/env node
'use strict';

/**
 * Standalone health probe for demos / CI.
 *
 * Exits 0 when GET /api/health responds 200 with status "ok", otherwise 1.
 * Intentionally has no dependency on the app config so it can be run against
 * a remote instance too:  PORT=3000 npm run health-check
 */

const port = Number(process.env.PORT) || 3000;
const host = process.env.HEALTH_HOST || '127.0.0.1';
const url = `http://${host}:${port}/api/health`;

const timeout = AbortSignal.timeout(5000);

fetch(url, { signal: timeout })
  .then(async (res) => {
    let body = null;
    try {
      body = await res.json();
    } catch {
      /* ignore parse errors, handled below */
    }
    const ok = res.status === 200 && body && body.data && body.data.status === 'ok';
    if (ok) {
      console.log(`[health-check] OK  ${url}  ->`, JSON.stringify(body.data));
      process.exit(0);
    }
    console.error(`[health-check] FAIL ${url}  status=${res.status}  body=${JSON.stringify(body)}`);
    process.exit(1);
  })
  .catch((err) => {
    console.error(`[health-check] FAIL ${url}  ${err.message}`);
    process.exit(1);
  });
