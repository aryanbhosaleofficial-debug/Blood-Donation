import React from 'react';
import { StatusBadge } from '../common/StatusBadge.jsx';
import { Users, Info } from 'lucide-react';

export function DonorFallbackStatus({ fallbackInfo }) {
  const status = fallbackInfo?.status || 'INACTIVE';
  const count = fallbackInfo?.potentialDonorsAlerted ?? 0;

  return (
    <section className="card">
      <div className="card-header">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Users size={18} style={{ color: 'var(--color-primary-800)' }} />
          Potential Community Donor Fallback
        </h3>
        <StatusBadge status={status} />
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>
            Potential Donor Alerts Assigned
          </span>
          <strong style={{ fontSize: 'var(--font-size-2xl)', color: 'var(--color-text-primary)' }}>
            {count}
          </strong>
        </div>
      </div>

      <div className="disclaimer-box">
        Alert counts indicate candidate individuals notified for potential response. They do not represent collected units, clinical compatibility, or medical eligibility.
      </div>
    </section>
  );
}
