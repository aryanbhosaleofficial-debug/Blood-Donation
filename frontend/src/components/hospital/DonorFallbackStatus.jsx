import React from 'react';

export function DonorFallbackStatus({ fallbackInfo }) {
  const status = fallbackInfo?.status || 'INACTIVE';
  const count = fallbackInfo?.potentialDonorsAlerted ?? 0;

  return (
    <section className="card">
      <h3>Potential Donor Fallback Status</h3>
      <p>
        <strong>Status:</strong> {status} · <strong>Potential donor alerts assigned:</strong> {count}
      </p>
      <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
        Alert counts indicate candidate individuals notified for potential response. They do not represent collected units, clinical compatibility, or medical eligibility.
      </p>
    </section>
  );
}
