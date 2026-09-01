import React, { useState } from 'react';
import { Button } from '../common/Button.jsx';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { useToast } from '../common/ToastContext.jsx';

export function PledgeControl({ pledge, onCancel, onArrive }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();

  if (!pledge) return null;

  const handleCancel = async () => {
    if (!window.confirm('Cancel your response pledge for this emergency request?')) return;
    setBusy(true);
    setError(null);
    try {
      await onCancel();
      toast.info('Response pledge cancelled.');
    } catch (err) {
      const msg = err && err.message ? err.message : 'Could not cancel pledge.';
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleArrive = async () => {
    setBusy(true);
    setError(null);
    try {
      await onArrive();
      toast.success('Arrival marked. Facility notified.');
    } catch (err) {
      const msg = err && err.message ? err.message : 'Could not mark arrival.';
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 'var(--space-4)' }}>
      {error && (
        <div className="form-error" role="alert" style={{ marginBottom: 'var(--space-3)' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {pledge.status === 'PLEDGED' && (
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Button
            variant="success"
            disabled={busy}
            loading={busy}
            onClick={handleArrive}
            icon={<CheckCircle2 size={16} />}
          >
            {busy ? 'Processing…' : 'Mark Arrived'}
          </Button>

          <Button
            variant="danger"
            disabled={busy}
            onClick={handleCancel}
            icon={<XCircle size={16} />}
          >
            {busy ? 'Processing…' : 'Cancel Pledge'}
          </Button>
        </div>
      )}

      <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', lineHeight: 1.5, marginTop: 'var(--space-2)' }}>
        “Arrived” indicates you reported reaching the hospital donation facility. It does not replace medical intake, pre-donation hemoglobin testing, or blood qualification.
      </p>
    </div>
  );
}
