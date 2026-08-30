/**
 * frontend/src/api/csrf-token.js
 *
 * In-memory storage for the session CSRF token.
 * Never persisted to localStorage, sessionStorage, or IndexedDB.
 */

let memoryToken = null;

export function getCsrfToken() {
  return memoryToken;
}

export function setCsrfToken(token) {
  memoryToken = token || null;
}

export function clearCsrfToken() {
  memoryToken = null;
}
