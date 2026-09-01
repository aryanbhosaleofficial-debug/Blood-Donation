import React from 'react';

/**
 * Renders audit rows. Metadata is shown as pretty-printed JSON text inside a
 * <pre> via JSON.stringify, so HTML-like values always render as plain text
 * (XSS-safe). No raw-HTML injection APIs are used anywhere in this component.
 */
export function AuditLogTable({ rows }) {
  if (!rows || rows.length === 0) {
    return <p style={{ color: 'var(--color-text-muted)', padding: 'var(--space-6)', textAlign: 'center' }}>No audit events match the current filters.</p>;
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
            <th>Metadata Context</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td style={{ whiteSpace: 'nowrap', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                {row.createdAt}
              </td>
              <td>
                <span className="badge" style={{ backgroundColor: 'var(--color-primary-50)', color: 'var(--color-primary-900)', border: '1px solid var(--color-border)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {row.action}
                </span>
              </td>
              <td>
                {row.entityType ? (
                  <strong style={{ fontSize: 'var(--font-size-sm)' }}>
                    {row.entityType}{row.entityId != null ? ` #${row.entityId}` : ''}
                  </strong>
                ) : (
                  '—'
                )}
              </td>
              <td>
                <span style={{ color: row.actorUserId != null ? 'var(--color-text-primary)' : 'var(--color-text-muted)', fontWeight: row.actorUserId != null ? 600 : 400 }}>
                  {row.actorUserId != null ? `User #${row.actorUserId}` : 'system'}
                </span>
              </td>
              <td style={{ maxWidth: 360 }}>
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    fontSize: '0.72rem',
                    backgroundColor: 'var(--color-surface-subtle)',
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    maxHeight: 120,
                    overflowY: 'auto',
                  }}
                >
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
