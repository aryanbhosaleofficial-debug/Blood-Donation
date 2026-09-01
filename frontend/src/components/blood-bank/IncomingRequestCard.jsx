import React from 'react';
import { Link } from 'react-router-dom';
import { formatDateTime } from '../../utils/dates.js';
import { BloodGroupBadge } from '../common/BloodGroupBadge.jsx';
import { UrgencyBadge } from '../common/UrgencyBadge.jsx';
import { StatusBadge } from '../common/StatusBadge.jsx';
import { Building2, Clock, MapPin, ArrowRight } from 'lucide-react';

export function IncomingRequestCard({ request }) {
  if (!request) return null;
  const hospital = request.hospital || {};
  const location = [hospital.locality, hospital.city].filter(Boolean).join(', ') || 'Location not shared';
  const needed = request.unitsNeeded;
  const allocated = request.bankUnitsAllocated ?? 0;
  const remaining = request.remainingBankUnits ?? needed;

  return (
    <article className={`request-card urgency-${String(request.urgency).toLowerCase()}`}>
      <div className="request-card-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <BloodGroupBadge bloodGroup={request.bloodGroup} />
          <strong>
            {request.unitsNeeded} {request.unitsNeeded === 1 ? 'unit' : 'units'} of {request.component || 'Red Cells'}
          </strong>
          <UrgencyBadge urgency={request.urgency} />
        </div>
        <StatusBadge status={request.status} isPastExpiry={request.isPastExpiry} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', marginTop: 2 }}>
        <Building2 size={15} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
        <strong>{hospital.name || 'Hospital'}</strong>
        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
        <span style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}>
          <MapPin size={13} /> {location}
        </span>
      </div>

      <div className="request-card-meta">
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={13} /> Created: {formatDateTime(request.createdAt)}
        </span>
        <span>·</span>
        <span>Expires: {formatDateTime(request.expiresAt)}</span>
        <span>·</span>
        <span>Allocated: <strong>{allocated}</strong> / Remaining: <strong>{remaining} {remaining === 1 ? 'unit' : 'units'}</strong></span>
      </div>

      <div style={{ marginTop: 'var(--space-2)', display: 'flex', justifyContent: 'flex-end' }}>
        <Link
          to={`/blood-bank/requests/${request.id}`}
          className="btn btn-secondary btn-sm"
        >
          View &amp; Reserve Stock <ArrowRight size={14} />
        </Link>
      </div>
    </article>
  );
}
