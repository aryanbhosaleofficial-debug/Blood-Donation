#!/usr/bin/env node
'use strict';

/**
 * scripts/dev.js  —  one command to run the backend + frontend dev servers.
 *
 *   npm run dev
 *
 * Dependency-free: spawns `node --watch backend/src/server.js` and
 * `npm --prefix frontend run dev`, prefixes their output, and stops both on
 * Ctrl+C. Run them separately with `npm run dev:backend` / `npm run dev:frontend`.
 */

const { spawn } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const procs = [
  { name: 'backend ', cmd: process.execPath, args: ['--watch', path.join('backend', 'src', 'server.js')] },
  { name: 'frontend', cmd: npm, args: ['--prefix', 'frontend', 'run', 'dev'] },
];

const children = procs.map(({ name, cmd, args }) => {
  const child = spawn(cmd, args, { cwd: ROOT, env: process.env });
  const prefix = (line) => `[${name}] ${line}`;
  const pipe = (stream, out) => {
    let buf = '';
    stream.on('data', (chunk) => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const l of lines) out.write(`${prefix(l)}\n`);
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    process.stdout.write(`[${name}] exited (${code})\n`);
    stopAll();
  });
  return child;
});

let stopping = false;
function stopAll() {
  if (stopping) return;
  stopping = true;
  for (const c of children) { try { c.kill(); } catch { /* already gone */ } }
  setTimeout(() => process.exit(0), 500).unref();
}

process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);
