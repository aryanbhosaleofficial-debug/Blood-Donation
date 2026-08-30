/**
 * frontend/src/api/api-client.js
 *
 * Central HTTP client for the React frontend.
 * - Prefixes requests with /api
 * - Uses credentials: 'include' for session cookie transmission
 * - Attaches X-CSRF-Token from memory on state-changing requests
 * - Unwraps { data } payload on 2xx responses
 * - Throws normalized ApiError on failures
 * - Triggers onUnauthorized callback on 401 responses
 */

import { getCsrfToken, clearCsrfToken } from './csrf-token.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

let onUnauthorizedHandler = null;

export function setUnauthorizedHandler(handler) {
  onUnauthorizedHandler = handler;
}

export class ApiError extends Error {
  constructor(code, message, status, details) {
    super(message || code);
    this.name = 'ApiError';
    this.code = code || `HTTP_${status}`;
    this.status = status ?? 0;
    this.details = details;
  }
}

async function request(pathname, { method = 'GET', body, headers = {}, signal } = {}) {
  const upperMethod = method.toUpperCase();
  const finalHeaders = {
    Accept: 'application/json',
    ...headers,
  };

  const init = {
    method: upperMethod,
    headers: finalHeaders,
    credentials: 'include',
    signal,
  };

  if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  if (!SAFE_METHODS.has(upperMethod)) {
    const token = getCsrfToken();
    if (token) {
      finalHeaders['X-CSRF-Token'] = token;
    }
  }

  const url = `${API_BASE_URL}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;

  let response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw err;
    }
    throw new ApiError('NETWORK_ERROR', 'Unable to reach the server. Check your connection.', 0, {
      cause: String(err),
    });
  }

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearCsrfToken();
      if (typeof onUnauthorizedHandler === 'function' && pathname !== '/auth/me' && pathname !== '/auth/login') {
        onUnauthorizedHandler();
      }
    }

    const apiError = payload && payload.error ? payload.error : {};
    throw new ApiError(
      apiError.code || `HTTP_${response.status}`,
      apiError.message || response.statusText || 'Request failed.',
      response.status,
      apiError.details,
    );
  }

  return payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload;
}

export const apiClient = {
  request,
  get: (pathname, options) => request(pathname, { ...options, method: 'GET' }),
  post: (pathname, body, options) => request(pathname, { ...options, method: 'POST', body }),
  patch: (pathname, body, options) => request(pathname, { ...options, method: 'PATCH', body }),
  put: (pathname, body, options) => request(pathname, { ...options, method: 'PUT', body }),
  delete: (pathname, options) => request(pathname, { ...options, method: 'DELETE' }),
};
