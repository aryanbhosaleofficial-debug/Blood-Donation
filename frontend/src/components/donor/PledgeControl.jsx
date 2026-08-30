import React, { useState } from 'react';

export function PledgeControl({ pledge, onCancel, onArrive }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!pledge) return null;

  const handleCancel = async () => {
    if (!window.confirm('Cancel your response pledge for this emergency request?')) return;
    setBusy(true);
    setError(null);
    try {
      await onCancel();
    } catch (err) {
      setError(err && err.message ? err.message : 'Could not cancel pledge.');
    } finally {
      setBusy(false);
    }
  };

  const handleArrive = async () => {
    setBusy(true);
    setError(null);
    try {
      await onArrive();
    } catch (err) {
      setError(err && err.message ? err.message : 'Could not mark arrival.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      {error && <div className="form-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {pledge.status === 'PLEDGED' && (
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={handleCancel}
          >
            {busy ? 'Processing…' : 'Cancel Pledge'}
          </button>
          <button
            type="button"
            className="btn btn-success"
            disabled={busy}
            onClick={handleArrive}
          >
            {busy ? 'Processing…' : 'Mark Arrived at Facility'}
          </button>
        </div>
      )}

      <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
        “Arrived” means you reported reaching the hospital or collection facility. It does not mean blood donation, acceptance, testing, or clinical readiness.
      </p>
    </div>
  );
}
