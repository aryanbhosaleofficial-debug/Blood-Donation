import React from 'react';

/**
 * A single labelled metric value. `hint` is optional safe-wording context.
 */
export function MetricsCard({ label, value, hint }) {
  return (
    <div className="card metrics-card" style={{ minWidth: '9rem' }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{value ?? '—'}</div>
      <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>{label}</div>
      {hint && <div style={{ color: 'var(--muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{hint}</div>}
    </div>
  );
}
