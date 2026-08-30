import React from 'react';

/**
 * Renders audit rows. Metadata is shown as pretty-printed JSON text inside a
 * <pre> via JSON.stringify, so HTML-like values always render as plain text
 * (XSS-safe). No raw-HTML injection APIs are used anywhere in this component.
 */
export function AuditLogTable({ rows }) {
  if (!rows || rows.length === 0) {
    return <p style={{ color: 'var(--muted)' }}>No audit events match the current filters.</p>;
  }

  return (
    <div className="table-responsive">
      <table>
        <thead>
          <tr>
            <th>Time (UTC)</th>
            <th>Action</th>
            <th>Entity</th>
            <th>Actor User</th>
            <th>Metadata</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.createdAt}</td>
              <td>{row.action}</td>
              <td>{row.entityType ? `${row.entityType}${row.entityId != null ? ` #${row.entityId}` : ''}` : '—'}</td>
              <td>{row.actorUserId != null ? row.actorUserId : 'system'}</td>
              <td>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.75rem' }}>
                  {JSON.stringify(row.metadata ?? {}, null, 2)}
                </pre>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
