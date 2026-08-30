/**
 * frontend/core/session
 *
 * Loads the current user from the server on page load and exposes it to the
 * rest of the frontend. The server session is always the source of truth;
 * nothing here is persisted to localStorage.
 *
 *   load()             - GET /api/auth/me once, cache the result
 *   getUser()          - cached user object or null
 *   isAuthenticated()  - boolean
 *   setUser(user)      - update the cache (e.g. right after login)
 *   clear()            - drop the cached user and CSRF token
 */

import { apiClient, ApiError } from './api-client.js';
import { clearCsrfToken } from './csrf.js';

const state = {
  loaded: false,
  user: null,
};

let loadPromise = null;

async function fetchMe() {
  try {
    const data = await apiClient.get('/auth/me');
    state.user = data && data.user ? data.user : null;
  } catch (err) {
    // 401 => not signed in. Any other failure => also treat as unauthenticated
    // for bootstrap purposes (the UI will surface connection errors elsewhere).
    if (!(err instanceof ApiError)) {
      state.user = null;
    } else {
      state.user = null;
    }
  } finally {
    state.loaded = true;
  }
  return getUser();
}

export function load() {
  if (!loadPromise) {
    loadPromise = fetchMe();
  }
  return loadPromise;
}

export function getUser() {
  return state.user ? { ...state.user } : null;
}

export function isAuthenticated() {
  return state.user !== null;
}

export function setUser(user) {
  state.user = user || null;
}

export function clear() {
  state.user = null;
  loadPromise = null;
  state.loaded = false;
  clearCsrfToken();
}
