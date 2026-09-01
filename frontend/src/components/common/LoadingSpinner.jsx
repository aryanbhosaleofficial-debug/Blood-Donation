import React from 'react';

export function LoadingSpinner({ message = 'Loading…' }) {
  return (
    <div className="spinner-container" role="status">
      <div className="spinner" />
      <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
        {message}
      </p>
    </div>
  );
}
