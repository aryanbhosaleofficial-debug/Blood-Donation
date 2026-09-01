import React from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../common/StatusBadge.jsx';
import { BloodGroupBadge } from '../common/BloodGroupBadge.jsx';
import { UrgencyBadge } from '../common/UrgencyBadge.jsx';
import { formatDateTime } from '../../utils/dates.js';
import { Clock, ArrowRight, PackageCheck, AlertCircle } from 'lucide-react';

export function RequestCard({ request }) {
  if (!request) return null;

  const allocated = request.bankUnitsAllocated ?? 0;
  const needed = request.unitsNeeded;
  const remaining = request.remainingBankUnits ?? needed;
  const pct = Math.min(100, Math.round((allocated / (needed || 1)) * 100));

  return (
    <article className={`request-card urgency-${String(request.urgency).toLowerCase()}`}>
      <div className="request-card-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <BloodGroupBadge bloodGroup={request.bloodGroup} />
          <strong>
            {request.unitsNeeded} {request.unitsNeeded === 1 ? 'unit' : 'units'} of {request.component || 'Red Cells'}
          </strong>
          <UrgencyBadge urgency={request.urgency} />
        </div>
        <StatusBadge status={request.status} isPastExpiry={request.isPastExpiry} />
      </div>

      {/* Coverage Progress Strip */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, margin: 'var(--space-1) 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
          <span>
            Bank Allocation: <strong>{allocated} of {needed} units</strong> ({pct}%)
          </span>
          <span>
            Remaining: <strong>{remaining} {remaining === 1 ? 'unit' : 'units'}</strong>
          </span>
        </div>
        <div className="coverage-progress-bar">
          <div
            className={`coverage-progress-fill ${pct === 100 ? 'full' : ''}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="request-card-meta">
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={13} /> Created: {formatDateTime(request.createdAt)}
        </span>
        <span>·</span>
        <span>Expires: {formatDateTime(request.expiresAt)}</span>
        {request.note && (
          <>
            <span>·</span>
            <span style={{ fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
              Note: “{request.note.length > 50 ? `${request.note.slice(0, 50)}…` : request.note}”
            </span>
          </>
        )}
      </div>

      <div style={{ marginTop: 'var(--space-2)', display: 'flex', justifyContent: 'flex-end' }}>
        <Link
          to={`/hospital/requests/${request.id}`}
          className="btn btn-secondary btn-sm"
        >
          View Details <ArrowRight size={14} />
        </Link>
      </div>
    </article>
  );
}
