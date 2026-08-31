'use strict';

/**
 * security/pg-session-store
 *
 * A PostgreSQL-backed express-session store, replacing connect-sqlite3 when
 * DB_PROVIDER=supabase. Sessions live in the `sessions` table
 * (sid TEXT PK, sess JSONB, expires_at TIMESTAMPTZ). This is the ONLY thing
 * that stops the SQLite→PostgreSQL migration from forcing a move to JWTs.
 *
 * It uses a direct `pg` Pool (SUPABASE_DB_URL) rather than PostgREST: session
 * reads/writes happen on every authenticated request and need low latency and
 * simple upserts. Session contents never go to Gemini and are never migrated
 * by the data-migration script (see scripts/migrate-sqlite-to-supabase.js).
 *
 * Implements the express-session Store contract: get / set / destroy / touch,
 * plus length / clear / all. Expired rows are swept opportunistically and by
 * an interval timer (unref'd, so it never keeps the process alive).
 */

const session = require('express-session');

const { Store } = session;

class PgSessionStore extends Store {
  /**
   * @param {object} opts
   * @param {import('pg').Pool} opts.pool          — a connected pg Pool
   * @param {number} [opts.ttlSeconds]             — fallback TTL when the cookie has no maxAge
   * @param {number} [opts.pruneIntervalMs]        — 0 disables the sweep timer
   */
  constructor({ pool, ttlSeconds = 4 * 3600, pruneIntervalMs = 15 * 60 * 1000 } = {}) {
    super();
    if (!pool) throw new Error('PgSessionStore requires a pg Pool');
    this.pool = pool;
    this.ttlSeconds = ttlSeconds;
    if (pruneIntervalMs > 0) {
      this._timer = setInterval(() => {
        this.prune().catch(() => {});
      }, pruneIntervalMs);
      this._timer.unref?.();
    }
  }

  _expiryFor(sess) {
    const cookieMaxAge = sess && sess.cookie && sess.cookie.maxAge;
    const ms = Number.isFinite(cookieMaxAge) ? cookieMaxAge : this.ttlSeconds * 1000;
    return new Date(Date.now() + ms);
  }

  get(sid, cb) {
    this.pool
      .query('SELECT sess, expires_at FROM sessions WHERE sid = $1', [sid])
      .then((r) => {
        if (r.rowCount === 0) return cb(null, null);
        const row = r.rows[0];
        if (new Date(row.expires_at).getTime() <= Date.now()) {
          return this.destroy(sid, () => cb(null, null));
        }
        const sess = typeof row.sess === 'string' ? JSON.parse(row.sess) : row.sess;
        return cb(null, sess);
      })
      .catch((err) => cb(err));
  }

  set(sid, sess, cb) {
    const expiresAt = this._expiryFor(sess);
    this.pool
      .query(
        `INSERT INTO sessions (sid, sess, expires_at)
         VALUES ($1, $2::jsonb, $3)
         ON CONFLICT (sid)
         DO UPDATE SET sess = EXCLUDED.sess, expires_at = EXCLUDED.expires_at`,
        [sid, JSON.stringify(sess), expiresAt],
      )
      .then(() => cb && cb(null))
      .catch((err) => cb && cb(err));
  }

  destroy(sid, cb) {
    this.pool
      .query('DELETE FROM sessions WHERE sid = $1', [sid])
      .then(() => cb && cb(null))
      .catch((err) => cb && cb(err));
  }

  touch(sid, sess, cb) {
    const expiresAt = this._expiryFor(sess);
    this.pool
      .query('UPDATE sessions SET expires_at = $2 WHERE sid = $1', [sid, expiresAt])
      .then(() => cb && cb(null))
      .catch((err) => cb && cb(err));
  }

  length(cb) {
    this.pool
      .query('SELECT COUNT(*)::int AS n FROM sessions WHERE expires_at > now()')
      .then((r) => cb(null, r.rows[0].n))
      .catch((err) => cb(err));
  }

  clear(cb) {
    this.pool
      .query('DELETE FROM sessions')
      .then(() => cb && cb(null))
      .catch((err) => cb && cb(err));
  }

  all(cb) {
    this.pool
      .query('SELECT sid, sess FROM sessions WHERE expires_at > now()')
      .then((r) => {
        const out = {};
        for (const row of r.rows) {
          out[row.sid] = typeof row.sess === 'string' ? JSON.parse(row.sess) : row.sess;
        }
        cb(null, out);
      })
      .catch((err) => cb(err));
  }

  prune() {
    return this.pool.query('DELETE FROM sessions WHERE expires_at <= now()');
  }

  stopPruneTimer() {
    if (this._timer) clearInterval(this._timer);
  }
}

module.exports = { PgSessionStore };
