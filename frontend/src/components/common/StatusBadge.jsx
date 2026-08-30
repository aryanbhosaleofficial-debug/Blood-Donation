import React from 'react';

export function StatusBadge({ status, isPastExpiry = false }) {
  if (!status) return null;
  const normalized = String(status).toLowerCase();

  let label = status;
  if (status === 'OPEN' && isPastExpiry) {
    label = 'OPEN (past expiry)';
  }

  return <span className={`status-badge status-${normalized}`}>{label}</span>;
}
