import React from 'react';

export function LoadingSpinner({ message = 'Loading…' }) {
  return (
    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }} role="status">
      <p>{message}</p>
    </div>
  );
}
