import React from 'react';
import { Modal } from './Modal.jsx';
import { Button } from './Button.jsx';
import { AlertTriangle, Info } from 'lucide-react';

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger-solid' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
        <div
          style={{
            padding: 'var(--space-2)',
            borderRadius: 'var(--radius-full)',
            backgroundColor: variant === 'danger' ? 'var(--color-error-bg)' : 'var(--color-info-bg)',
            color: variant === 'danger' ? 'var(--color-error)' : 'var(--color-info)',
            flexShrink: 0,
          }}
        >
          {variant === 'danger' ? <AlertTriangle size={24} /> : <Info size={24} />}
        </div>
        <div>
          <p style={{ color: 'var(--color-text-primary)', fontSize: 'var(--font-size-base)', lineHeight: 1.5 }}>
            {message}
          </p>
        </div>
      </div>
    </Modal>
  );
}
