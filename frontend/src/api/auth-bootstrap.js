import { ApiError } from './api-client.js';
import { authApi } from './auth.api.js';

let inFlightBootstrap = null;

async function performBootstrap() {
  try {
    const data = await authApi.getMe();
    const user = data?.user || null;

    if (!user) {
      return { status: 'unauthenticated', user: null, csrfToken: null };
    }

    // CSRF is requested only after /auth/me has established a valid session.
    // The token is returned to AuthProvider, which keeps it in memory only.
    let csrfToken = null;
    try {
      const csrfData = await authApi.getCsrfToken();
      csrfToken = csrfData?.csrfToken || null;
    } catch {
      // A transient CSRF fetch failure must not invent an unauthenticated state.
      // Unsafe requests remain protected because the client has no token.
    }

    return { status: 'authenticated', user, csrfToken };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return { status: 'unauthenticated', user: null, csrfToken: null };
    }
    throw error;
  }
}

/**
 * Deduplicate only the currently running startup probe. Results are not cached,
 * so login, logout, session expiry, and an explicit refresh cannot reuse stale
 * authentication state.
 */
export function bootstrapAuthSession() {
  if (!inFlightBootstrap) {
    inFlightBootstrap = performBootstrap().finally(() => {
      inFlightBootstrap = null;
    });
  }
  return inFlightBootstrap;
}
