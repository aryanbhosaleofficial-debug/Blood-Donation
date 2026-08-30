import React from 'react';
import { formatDomainError } from '../../utils/formatters.js';

export function ErrorAlert({ error, onRetry }) {
  if (!error) return null;
  const message = formatDomainError(error);

  return (
    <div className="form-error" role="alert" style={{ marginBottom: '1rem' }}>
      <strong>Error: </strong> {message}
      {onRetry && (
        <button
          type="button"
          className="btn btn-secondary"
          style={{ marginLeft: '1rem', padding: '0.2rem 0.5rem', fontSize: '0.85rem' }}
          onClick={onRetry}
        >
          Retry
        </button>
      )}
    </div>
  );
}
