'use strict';

/**
 * core/supabase
 *
 * The single Supabase entry point for the backend. Everything that talks to
 * Supabase PostgreSQL goes through the client returned here — there are no
 * scattered `createClient()` calls.
 *
 * - Uses the SERVICE-ROLE key. This key bypasses RLS, so Express remains the
 *   authoritative authorization layer (sessions, roles, ownership checks).
 * - The key is read only from `core/config` (which is the only module allowed
 *   to touch `process.env`). It is never logged and never sent anywhere except
 *   the Supabase API host.
 * - Lazy + memoized: importing this module has no side effects. The client is
 *   built on first use, and only when `DB_PROVIDER=supabase`.
 * - `@supabase/supabase-js` is required lazily so a `DB_PROVIDER=sqlite`
 *   deployment never loads it.
 *
 * Domain-error mapping (Supabase/PostgREST error -> app error code) lives in
 * `core/supabase-errors`; repositories call `mapSupabaseError(error)` and
 * never surface a raw PostgREST payload, SQL, or schema detail to a client.
 */

const config = require('./config');

let cachedClient = null;

/** True when the app is configured to use Supabase as its database. */
function isSupabaseEnabled() {
  return config.database.provider === 'supabase';
}

/**
 * Get the memoized service-role Supabase client.
 * @throws {Error} if called while DB_PROVIDER !== 'supabase' or config is missing.
 */
function getSupabase() {
  if (cachedClient) return cachedClient;

  if (!isSupabaseEnabled()) {
    throw new Error(
      'getSupabase() called but DB_PROVIDER is not "supabase". ' +
        'Guard Supabase code paths with isSupabaseEnabled().',
    );
  }
  const { supabaseUrl, supabaseServiceRoleKey } = config.database;
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase is enabled but SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set.');
  }

  // Lazy require: never loaded under DB_PROVIDER=sqlite.
  // eslint-disable-next-line global-require
  const { createClient } = require('@supabase/supabase-js');
  cachedClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
    global: { headers: { 'x-application-name': 'community-blood-donation-system' } },
  });
  return cachedClient;
}

/** Reset the memoized client (tests only). */
function resetSupabaseClient() {
  cachedClient = null;
}

/**
 * Lightweight connectivity probe for the health endpoint. Never throws;
 * returns a boolean. Does not leak the URL or key.
 */
async function pingSupabase() {
  if (!isSupabaseEnabled()) return false;
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('app_meta').select('key').limit(1);
    return !error;
  } catch {
    return false;
  }
}

module.exports = { isSupabaseEnabled, getSupabase, resetSupabaseClient, pingSupabase };
