import React from 'react';

const LABELS = {
  PENDING: 'Pending review',
  CONFIRMED: 'Confirmed',
  REJECTED: 'Rejected',
  STALE: 'Stale',
  ACTIVE: 'Active',
  CLOSED: 'Closed',
};

/**
 * Status pill for a surge candidate / event, plus a separate DEMO pill for
 * synthetic data so it never looks like real operational detection.
 */
export function SurgeStatusBadge({ status, isSynthetic }) {
  return (
    <span>
      {status && (
        <span className={`status-badge status-${String(status).toLowerCase()}`}>
          {LABELS[status] || status}
        </span>
      )}
      {isSynthetic && (
        <span
          className="status-badge status-demo"
          style={{ marginLeft: '0.4rem' }}
          title="Synthetic demo data — not real operational detection"
        >
          DEMO
        </span>
      )}
    </span>
  );
}
