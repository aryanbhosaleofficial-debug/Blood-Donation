import React from 'react';
import { Link } from 'react-router-dom';
import { formatDateTime } from '../../utils/dates.js';

export function IncomingRequestCard({ request }) {
  if (!request) return null;
  const hospital = request.hospital || {};
  const location = [hospital.locality, hospital.city].filter(Boolean).join(', ') || 'Location not shared';

  return (
    <article className={`request-card urgency-${String(request.urgency).toLowerCase()}`}>
      <div className="request-card-head">
        <strong>
          {request.bloodGroup} · {request.unitsNeeded} unit(s) · {request.urgency}
        </strong>
      </div>

      <p className="request-card-meta">
        <strong>{hospital.name || 'Hospital'}</strong> — {location}
      </p>

      <p className="request-card-meta">
        Created {formatDateTime(request.createdAt)} · Expires {formatDateTime(request.expiresAt)}
      </p>

      <p className="request-card-meta">
        Allocated {request.bankUnitsAllocated ?? 0} · Remaining required: {request.remainingBankUnits ?? request.unitsNeeded}
      </p>

      <div style={{ marginTop: '0.5rem' }}>
        <Link
          to={`/blood-bank/requests/${request.id}`}
          className="btn btn-secondary"
          style={{ padding: '0.3rem 0.75rem', fontSize: '0.85rem' }}
        >
          View & Reserve Stock
        </Link>
      </div>
    </article>
  );
}
