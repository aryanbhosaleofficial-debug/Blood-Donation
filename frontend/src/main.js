/**
 * frontend entry point (Phase 0).
 *
 * Boots the session probe and renders a tiny status page so the foundation
 * can be verified in a browser before a demo.
 */

import { apiClient, ApiError } from './core/api-client.js';
import { loadSession, getSession } from './core/session.js';
import { createRouter } from './core/router.js';

function statusRow(label, value) {
  const row = document.createElement('div');
  row.className = 'row';
  const k = document.createElement('span');
  k.className = 'k';
  k.textContent = label;
  const v = document.createElement('span');
  v.className = 'v';
  v.textContent = value;
  row.append(k, v);
  return row;
}

function homeView(outlet) {
  const section = document.createElement('section');
  const h = document.createElement('h2');
  h.textContent = 'System Status';
  const card = document.createElement('div');
  card.className = 'card';
  card.textContent = 'Checking backend health…';
  section.append(h, card);
  outlet.append(section);

  apiClient
    .get('/health')
    .then((data) => {
      card.textContent = '';
      card.append(
        statusRow('Backend', data.status ?? 'unknown'),
        statusRow('Database', data.db ?? 'unknown'),
        statusRow('Schema version', String(data.schemaVersion ?? '—')),
        statusRow('Uptime (s)', String(data.uptimeSeconds ?? '—')),
        statusRow('Server time', data.timestamp ?? '—'),
      );
    })
    .catch((err) => {
      card.textContent =
        err instanceof ApiError ? `Health check failed: ${err.message}` : 'Health check failed.';
      card.classList.add('error');
    });
}

function notFoundView(outlet) {
  const p = document.createElement('p');
  p.textContent = 'Page not found.';
  outlet.append(p);
}

async function boot() {
  const outlet = document.getElementById('app');
  const badge = document.getElementById('session-badge');

  await loadSession();
  const s = getSession();
  if (badge) {
    badge.textContent = s.authenticated
      ? 'Signed in'
      : 'Not signed in — authentication arrives in Phase 1';
  }

  const router = createRouter({
    outlet,
    routes: { '/': homeView },
    fallback: notFoundView,
  });
  router.start();
}

boot();
