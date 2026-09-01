import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../common/StatusBadge.jsx';
import { BloodGroupBadge } from '../common/BloodGroupBadge.jsx';
import { UrgencyBadge } from '../common/UrgencyBadge.jsx';
import { Button } from '../common/Button.jsx';
import { Building2, MapPin, ArrowRight, X, Bell } from 'lucide-react';

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
    <article className="request-card" style={{ borderLeftColor: isActionable ? 'var(--color-accent-600)' : 'var(--color-border-strong)' }}>
      <div className="request-card-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <BloodGroupBadge bloodGroup={alert.request?.bloodGroup} />
          <strong>
            Emergency Red-Cell Alert · #{alert.request?.id || alert.id}
          </strong>
          {alert.request?.urgency && <UrgencyBadge urgency={alert.request.urgency} />}
        </div>
        <StatusBadge status={alert.status} />
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
        <span>Urgency: <strong>{alert.request?.urgency || '—'}</strong></span>
        <span>·</span>
        <span>Remaining requirement: <strong>{alert.request?.remainingRequirement ?? '—'} unit(s)</strong></span>
      </div>

      <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', margin: 'var(--space-1) 0' }}>
        {isActionable
          ? 'This is a potential compatibility notification only. Final suitability is determined by medical professionals.'
          : 'This alert is no longer actionable.'}
      </p>

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)', justifyContent: 'flex-end' }}>
        {canDismiss && (
          <Button
            variant="secondary"
            size="sm"
            disabled={dismissing}
            onClick={handleDismiss}
            icon={<X size={12} />}
          >
            {dismissing ? 'Dismissing…' : 'Dismiss'}
          </Button>
        )}
        <Link
          to={`/donor/alerts/${alert.id}`}
          className="btn btn-emergency btn-sm"
        >
          View Alert &amp; Pledge <ArrowRight size={13} />
        </Link>
      </div>
    </article>
  );
}
