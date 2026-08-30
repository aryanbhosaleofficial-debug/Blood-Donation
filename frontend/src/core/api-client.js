/**
 * frontend/core/api-client
 *
 * Thin fetch wrapper shared by every frontend module.
 *
 *  - prefixes /api
 *  - sends & parses JSON
 *  - attaches the CSRF header on state-changing requests (Phase 1+)
 *  - unwraps the { data } success envelope
 *  - throws a consistent ApiError on any non-2xx response or network failure
 */

const API_PREFIX = '/api';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

let csrfToken = null;

/** Set the per-session CSRF token (wired up in Phase 1). */
export function setCsrfToken(token) {
  csrfToken = token || null;
}

export function getCsrfToken() {
  return csrfToken;
}

export class ApiError extends Error {
  constructor(code, message, status, details) {
    super(message || code);
    this.name = 'ApiError';
    this.code = code;
    this.status = status ?? 0;
    this.details = details;
  }
}

async function request(pathname, { method = 'GET', body, headers = {}, signal } = {}) {
  const upperMethod = method.toUpperCase();
  const finalHeaders = { Accept: 'application/json', ...headers };
  const init = { method: upperMethod, headers: finalHeaders, credentials: 'same-origin', signal };

  if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  if (!SAFE_METHODS.has(upperMethod) && csrfToken) {
    finalHeaders['X-CSRF-Token'] = csrfToken;
  }

  let response;
  try {
    response = await fetch(API_PREFIX + pathname, init);
  } catch (err) {
    throw new ApiError('NETWORK_ERROR', 'Unable to reach the server.', 0, { cause: String(err) });
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
    const apiError = payload && payload.error ? payload.error : {};
    throw new ApiError(
      apiError.code || `HTTP_${response.status}`,
      apiError.message || response.statusText || 'Request failed.',
      response.status,
    );
  }

  return payload ? payload.data : null;
}

export const apiClient = {
  request,
  get: (pathname, options) => request(pathname, { ...options, method: 'GET' }),
  post: (pathname, body, options) => request(pathname, { ...options, method: 'POST', body }),
  patch: (pathname, body, options) => request(pathname, { ...options, method: 'PATCH', body }),
  put: (pathname, body, options) => request(pathname, { ...options, method: 'PUT', body }),
  del: (pathname, options) => request(pathname, { ...options, method: 'DELETE' }),
};
