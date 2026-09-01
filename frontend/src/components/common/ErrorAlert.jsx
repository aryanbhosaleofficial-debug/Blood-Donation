import React from 'react';
import { formatDomainError } from '../../utils/formatters.js';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button.jsx';

export function ErrorAlert({ error, onRetry, className = '' }) {
  if (!error) return null;
  const message = formatDomainError(error);

  return (
    <div className={`form-error ${className}`.trim()} role="alert" style={{ marginBottom: 'var(--space-4)' }}>
      <AlertCircle size={18} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <strong>Error: </strong> {message}
      </div>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          icon={<RefreshCw size={12} />}
        >
          Retry
        </Button>
      )}
    </div>
  );
}
