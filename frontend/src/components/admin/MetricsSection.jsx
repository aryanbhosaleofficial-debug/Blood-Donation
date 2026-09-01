import React from 'react';
import { MetricsCard } from './MetricsCard.jsx';

/**
 * A titled group of metric cards.
 * `items` is an array of { label, value, hint }.
 */
export function MetricsSection({ title, note, items = [] }) {
  return (
    <section className="card" style={{ marginBottom: 'var(--space-5)' }}>
      <div className="card-header" style={{ marginBottom: 'var(--space-3)' }}>
        <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {title}
        </h3>
      </div>
      {note && (
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-4)' }}>
          {note}
        </p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-3)' }}>
        {items.map((item) => (
          <MetricsCard key={item.label} label={item.label} value={item.value} hint={item.hint} />
        ))}
      </div>
    </section>
  );
}
