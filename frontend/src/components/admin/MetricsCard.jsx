import React from 'react';

/**
 * A single labelled metric card with high-contrast hierarchy.
 */
export function MetricsCard({ label, value, hint }) {
  return (
    <div className="card metrics-card" style={{ minWidth: '10rem', flex: '1 1 140px' }}>
      <div className="stat-value">{value ?? '—'}</div>
      <div className="stat-label" style={{ marginTop: 'var(--space-1)' }}>{label}</div>
      {hint && (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-1)' }}>
          {hint}
        </div>
      )}
    </div>
  );
}
