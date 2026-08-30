import React from 'react';
import { StatusBadge } from '../common/StatusBadge.jsx';

export function DonorPledgeList({ data }) {
  if (!data) return null;

  const pledges = data.pledges || [];
  const activeCount = data.activePotentialDonorPledges ?? 0;
  const maxSlots = data.maxPledgeSlots ?? 0;
  const availableSlots = data.availablePledgeSlots ?? 0;

  return (
    <section className="card">
      <h3>Potential Donor Responses</h3>
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
        Active responses: <strong>{activeCount}</strong> · Coordination slots: <strong>{maxSlots}</strong> · Available slots: <strong>{availableSlots}</strong>
      </p>

      {pledges.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No potential donor pledges received yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
          {pledges.map((pledge) => (
            <article key={pledge.publicReference} className="request-card" style={{ padding: '0.75rem 1rem' }}>
              <div className="request-card-head">
                <strong>Potential Donor {pledge.publicReference}</strong>
                <StatusBadge status={pledge.status} />
              </div>
              <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                <strong>Estimated ETA:</strong> {pledge.etaBand || 'unavailable (location sharing off)'}
              </p>
              <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                <strong>Distance Band:</strong> {pledge.distanceBand || 'unavailable'}
              </p>
            </article>
          ))}
        </div>
      )}

      <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '1rem' }}>
        {data.disclaimer ||
          'A pledge indicates a registered potential donor willingness to travel to the hospital facility. It does not replace professional blood-bank screening, medical history evaluation, testing, or cross-matching.'}
      </p>
    </section>
  );
}
