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
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {status && (
        <span className={`status-badge status-${String(status).toLowerCase()}`}>
          {LABELS[status] || status}
        </span>
      )}
      {isSynthetic && (
        <span
          className="status-badge status-demo"
          title="Synthetic demo data — not real operational detection"
        >
          DEMO
        </span>
      )}
    </span>
  );
}
