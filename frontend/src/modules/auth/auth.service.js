/**
 * frontend/modules/auth/auth.service
 *
 * Role-agnostic auth API calls used by the login page and the app shell.
 */

import { apiClient } from '../../core/api-client.js';
import { fetchCsrfToken, clearCsrfToken } from '../../core/csrf.js';
import { setUser, clear as clearSession } from '../../core/session.js';

/**
 * Log in, update the cached session user, then bootstrap a CSRF token so
 * subsequent state-changing requests (including logout) are protected.
 * @returns {Promise<object>} the public user
 */
export async function login(email, password) {
  const data = await apiClient.post('/auth/login', { email, password });
  const user = data && data.user ? data.user : null;
  setUser(user);
  try {
    await fetchCsrfToken();
  } catch {
    // A missing CSRF token is recoverable; the app will refetch on demand.
  }
  return user;
}

/** Log out server-side, then clear all client auth memory. */
export async function logout() {
  try {
    await apiClient.post('/auth/logout');
  } finally {
    clearSession();
    clearCsrfToken();
  }
}
