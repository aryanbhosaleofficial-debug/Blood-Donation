import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../common/StatusBadge.jsx';

export function AlertCard({ alert, onDismiss }) {
  const [dismissing, setDismissing] = useState(false);
  if (!alert) return null;

  const hospital = alert.hospital || {};
  const location = [hospital.locality, hospital.city].filter(Boolean).join(', ') || '—';
  const isActionable = alert.isActionable;
  const canDismiss = ['ACTIVE', 'VIEWED'].includes(alert.status);

  const handleDismiss = async () => {
    setDismissing(true);
    try {
      await onDismiss(alert.id);
    } finally {
      setDismissing(false);
    }
  };

  return (
    <article className="request-card">
      <div className="request-card-head">
        <strong>
          Potential Donor Alert · {alert.request?.bloodGroup || '—'} Red Cells
        </strong>
        <StatusBadge status={alert.status} />
      </div>

      <p className="request-card-meta">
        <strong>{hospital.name || 'Hospital'}</strong> — {location}
      </p>

      <p className="request-card-meta">
        Urgency: <strong>{alert.request?.urgency || '—'}</strong> · Remaining bank requirement:{' '}
        {alert.request?.remainingRequirement ?? '—'}
      </p>

      <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
        {isActionable
          ? 'This is a potential compatibility notification only. Final suitability is determined by medical professionals.'
          : 'This alert is no longer actionable.'}
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
        <Link
          to={`/donor/alerts/${alert.id}`}
          className="btn btn-primary"
          style={{ padding: '0.3rem 0.75rem', fontSize: '0.85rem' }}
        >
          View Alert & Pledge
        </Link>
        {canDismiss && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.3rem 0.75rem', fontSize: '0.85rem' }}
            disabled={dismissing}
            onClick={handleDismiss}
          >
            {dismissing ? 'Dismissing…' : 'Dismiss'}
          </button>
        )}
      </div>
    </article>
  );
}
