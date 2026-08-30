import React from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../common/StatusBadge.jsx';
import { formatDateTime } from '../../utils/dates.js';

export function RequestCard({ request }) {
  if (!request) return null;

  return (
    <article className={`request-card urgency-${String(request.urgency).toLowerCase()}`}>
      <div className="request-card-head">
        <strong>
          {request.bloodGroup} · {request.unitsNeeded} unit(s) · {request.urgency}
        </strong>
        <StatusBadge status={request.status} isPastExpiry={request.isPastExpiry} />
      </div>

      <div className="request-card-meta">
        Created {formatDateTime(request.createdAt)} · Expires {formatDateTime(request.expiresAt)}
      </div>

      <div className="request-card-meta">
        Allocated by banks: {request.bankUnitsAllocated ?? 0} · Remaining required:{' '}
        {request.remainingBankUnits ?? request.unitsNeeded}
      </div>

      <div style={{ marginTop: '0.5rem' }}>
        <Link
          to={`/hospital/requests/${request.id}`}
          className="btn btn-secondary"
          style={{ padding: '0.3rem 0.75rem', fontSize: '0.85rem' }}
        >
          View Details
        </Link>
      </div>
    </article>
  );
}
