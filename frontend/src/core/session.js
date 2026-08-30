/**
 * frontend/core/session
 *
 * Loads the current logged-in user once on page load and exposes it to the
 * rest of the frontend.
 *
 * Phase 0 note: authentication does not exist yet. There is no /api/auth/me
 * endpoint, so this module probes /api/health to confirm the backend is
 * reachable and always reports an unauthenticated session. Phase 1 replaces
 * the probe with a real /api/auth/me call and wires up setCsrfToken().
 */

import { apiClient, ApiError, setCsrfToken } from './api-client.js';

const session = {
  loaded: false,
  authenticated: false,
  user: null,
  backendReachable: false,
  error: null,
};

let loadPromise = null;

async function fetchSession() {
  try {
    // Phase 1: replace with `const data = await apiClient.get('/auth/me');`
    const health = await apiClient.get('/health');
    session.backendReachable = Boolean(health && health.status === 'ok');
    session.authenticated = false;
    session.user = null;
    session.error = null;
    setCsrfToken(null);
  } catch (err) {
    session.backendReachable = false;
    session.authenticated = false;
    session.user = null;
    session.error = err instanceof ApiError ? err : new ApiError('UNKNOWN', String(err), 0);
  } finally {
    session.loaded = true;
  }
  return getSession();
}

/** Kick off (or reuse) the one-time session load. */
export function loadSession() {
  if (!loadPromise) {
    loadPromise = fetchSession();
  }
  return loadPromise;
}

/** Synchronous snapshot of the session state. */
export function getSession() {
  return { ...session };
}

/** The current user object, or null when not signed in. */
export function getCurrentUser() {
  return session.user;
}

export function isAuthenticated() {
  return session.authenticated;
}

/** Force the next loadSession() call to hit the network again. */
export function resetSession() {
  loadPromise = null;
  session.loaded = false;
}
