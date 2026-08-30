import React from 'react';
import { MetricsCard } from './MetricsCard.jsx';

/**
 * A titled group of metric cards.
 * `items` is an array of { label, value, hint }.
 */
export function MetricsSection({ title, note, items }) {
  return (
    <section className="metrics-section" style={{ marginBottom: '1.5rem' }}>
      <h3>{title}</h3>
      {note && <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: 0 }}>{note}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
        {items.map((item) => (
          <MetricsCard key={item.label} label={item.label} value={item.value} hint={item.hint} />
        ))}
      </div>
    </section>
  );
}
