import React from 'react';

/**
 * Standard StatusBadge Component
 * Maps all domain statuses to semantic color tokens and readable labels.
 */
const STATUS_CONFIG = {
  OPEN: { label: 'Open', className: 'status-open' },
  COVERED: { label: 'Covered', className: 'status-covered' },
  COMPLETED: { label: 'Completed', className: 'status-completed' },
  CANCELLED: { label: 'Cancelled', className: 'status-cancelled' },
  EXPIRED: { label: 'Expired', className: 'status-expired' },
  RESERVED: { label: 'Reserved', className: 'status-reserved' },
  RELEASED: { label: 'Released', className: 'status-completed' },
  PLEDGED: { label: 'Pledged', className: 'status-pledged' },
  ARRIVED: { label: 'Arrived', className: 'status-arrived' },
  DEFERRED: { label: 'Deferred', className: 'status-deferred' },
  VERIFIED: { label: 'Verified', className: 'status-verified' },
  PENDING: { label: 'Pending', className: 'status-pending' },
  CONFIRMED: { label: 'Confirmed', className: 'status-confirmed' },
  REJECTED: { label: 'Rejected', className: 'status-rejected' },
  ACTIVE: { label: 'Active', className: 'status-active' },
  CLOSED: { label: 'Closed', className: 'status-closed' },
  STALE: { label: 'Stale', className: 'status-stale' },
  FRESH: { label: 'Fresh', className: 'status-open' },
  DEMO: { label: 'DEMO', className: 'status-demo' },
  QUEUED: { label: 'Queued', className: 'status-pending' },
  SENT: { label: 'Sent', className: 'status-covered' },
  FAILED: { label: 'Failed', className: 'status-cancelled' },
};

export function StatusBadge({ status, isPastExpiry = false, className = '' }) {
  if (!status) return null;

  const normalized = String(status).toUpperCase();
  const config = STATUS_CONFIG[normalized] || {
    label: status,
    className: `status-${String(status).toLowerCase()}`,
  };

  let label = config.label;
  if (normalized === 'OPEN' && isPastExpiry) {
    label = 'OPEN (past expiry)';
  }

  return (
    <span
      className={`status-badge ${config.className} status-${String(status).toLowerCase()} ${className}`.trim()}
    >
      {label}
    </span>
  );
}
