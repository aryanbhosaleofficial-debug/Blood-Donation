/**
 * frontend/core/csrf
 *
 * Owns the CSRF token in JS memory only (never localStorage/sessionStorage).
 *
 *   fetchCsrfToken()  - GET /api/auth/csrf-token and remember it
 *   getCsrfToken()    - current token or null
 *   setCsrfToken(t)   - store a token you already have
 *   clearCsrfToken()  - forget it (on logout / session loss)
 */

import { apiClient } from './api-client.js';

let token = null;

export function getCsrfToken() {
  return token;
}

export function setCsrfToken(value) {
  token = value || null;
}

export function clearCsrfToken() {
  token = null;
}

/** Fetch a fresh token from the server and store it. Requires an active session. */
export async function fetchCsrfToken() {
  const data = await apiClient.get('/auth/csrf-token');
  token = data && data.csrfToken ? data.csrfToken : null;
  return token;
}

// Convenience alias used after a successful login.
export const refreshCsrfToken = fetchCsrfToken;
