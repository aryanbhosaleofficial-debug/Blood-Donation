import React from 'react';
import { StatusBadge } from '../common/StatusBadge.jsx';
import { ShieldCheck, MapPin, Clock } from 'lucide-react';

export function DonorPledgeList({ data }) {
  if (!data) return null;

  const pledges = data.pledges || [];
  const activeCount = data.activePotentialDonorPledges ?? 0;
  const maxSlots = data.maxPledgeSlots ?? 0;
  const availableSlots = data.availablePledgeSlots ?? 0;

  return (
    <section className="card">
      <div className="card-header">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <ShieldCheck size={18} style={{ color: 'var(--color-primary-800)' }} />
          Potential Donor Responses
        </h3>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'flex', gap: 'var(--space-3)' }}>
          <span>Active responses: <strong>{activeCount}</strong></span>
          <span>·</span>
          <span>Slots: <strong>{activeCount}/{maxSlots}</strong></span>
          <span>·</span>
          <span>Available: <strong>{availableSlots}</strong></span>
        </div>
      </div>

      {pledges.length === 0 ? (
        <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-md)' }}>
          <p style={{ fontSize: 'var(--font-size-sm)' }}>No potential donor pledges received yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', margin: 'var(--space-4) 0' }}>
          {pledges.map((pledge) => (
            <article
              key={pledge.publicReference}
              className="request-card"
              style={{ padding: 'var(--space-3) var(--space-4)', backgroundColor: 'var(--color-surface-subtle)' }}
            >
              <div className="request-card-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <ShieldCheck size={16} style={{ color: 'var(--color-info)' }} />
                  <strong>Potential Donor {pledge.publicReference}</strong>
                </div>
                <StatusBadge status={pledge.status} />
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', fontSize: 'var(--font-size-sm)', marginTop: 4 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={13} style={{ color: 'var(--color-text-muted)' }} />
                  <strong>Estimated ETA:</strong> {pledge.etaBand || 'unavailable (location sharing off)'}
                </span>
                <span>·</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={13} style={{ color: 'var(--color-text-muted)' }} />
                  <strong>Distance Band:</strong> {pledge.distanceBand || 'unavailable'}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="disclaimer-box" style={{ marginTop: 'var(--space-4)' }}>
        {data.disclaimer ||
          'A pledge indicates a registered potential donor willingness to travel to the hospital facility. It does not replace professional blood-bank screening, medical history evaluation, testing, or cross-matching.'}
      </div>
    </section>
  );
}
