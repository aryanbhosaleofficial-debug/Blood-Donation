'use strict';

/**
 * modules/audit/audit.repository
 *
 * Low-level database access for audit_logs.
 * Audit log rows are append-only — no update/delete functions.
 */

/**
 * Insert one audit log row.
 *
 * @param {import('better-sqlite3').Database} db  — may be a transaction db handle
 * @param {object} opts
 * @param {number|null} opts.actorUserId
 * @param {string}      opts.action       — AUDIT_ACTION value
 * @param {string|null} [opts.entityType] — AUDIT_ENTITY value
 * @param {number|null} [opts.entityId]
 * @param {object}      [opts.metadata]   — safe, explicitly-constructed object
 * @returns {object} the inserted row
 */
function insert(db, { actorUserId = null, action, entityType = null, entityId = null, metadata = {} }) {
  const metaJson = JSON.stringify(metadata);
  const info = db.prepare(`
    INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(actorUserId ?? null, action, entityType ?? null, entityId ?? null, metaJson);
  return db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(Number(info.lastInsertRowid));
}

/**
 * Query audit logs with safe, validated filters.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object} filters
 * @param {string}  [filters.action]
 * @param {string}  [filters.entityType]
 * @param {number}  [filters.entityId]
 * @param {number}  [filters.actorUserId]
 * @param {string}  [filters.from]   — ISO datetime string (inclusive)
 * @param {string}  [filters.to]     — ISO datetime string (inclusive)
 * @param {number}  [filters.limit]
 * @param {number}  [filters.offset]
 * @returns {{ rows: object[], total: number }}
 */
function query(db, { action, entityType, entityId, actorUserId, from, to, limit = 50, offset = 0 } = {}) {
  const conditions = [];
  const params = [];

  if (action) { conditions.push('action = ?'); params.push(action); }
  if (entityType) { conditions.push('entity_type = ?'); params.push(entityType); }
  if (entityId != null) { conditions.push('entity_id = ?'); params.push(entityId); }
  if (actorUserId != null) { conditions.push('actor_user_id = ?'); params.push(actorUserId); }
  if (from) { conditions.push('created_at >= ?'); params.push(from); }
  if (to) { conditions.push('created_at <= ?'); params.push(to); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) AS n FROM audit_logs ${where}`).get(...params).n;
  const rows = db.prepare(
    `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  return { rows, total };
}

module.exports = { insert, query };
