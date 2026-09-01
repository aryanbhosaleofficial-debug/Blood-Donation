import React from 'react';

/**
 * MetricCard component
 */
export function MetricCard({ label, value, subtext = null, hint = null, icon = null }) {
  return (
    <div className="card metrics-card">
      <div className="stat-card-head">
        <span className="stat-label">{label}</span>
        {icon && <span style={{ color: 'var(--color-text-muted)' }}>{icon}</span>}
      </div>
      <div className="stat-value">{value ?? '—'}</div>
      {subtext && <div className="stat-subtext">{subtext}</div>}
      {hint && <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{hint}</div>}
    </div>
  );
}
