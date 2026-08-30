import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { surgeApi } from '../../api/surge.api.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { SurgeEvidencePanel } from '../../components/admin/SurgeEvidencePanel.jsx';

const CONFIRM_DIALOG =
  'This confirms an unusual blood-demand surge for operational monitoring. '
  + 'It does not confirm the external cause.';

/**
 * Admin surge candidate detail + review actions (Module 09).
 */
export function SurgeDetailPage() {
  const { candidateId } = useParams();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState(null);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await surgeApi.getCandidate(candidateId);
      setCandidate(res.candidate);
      setEvent(res.event || null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => { load(); }, [load]);

  const review = async (kind) => {
    if (kind === 'confirm' && !window.confirm(CONFIRM_DIALOG)) return;
    setBusy(true);
    setError(null);
    try {
      const fn = kind === 'confirm' ? surgeApi.confirmCandidate : surgeApi.rejectCandidate;
      const res = await fn(candidateId, note.trim() || undefined);
      setCandidate(res.candidate);
      setEvent(res.event || null);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading surge candidate…" />;

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Surge Candidate {candidateId ? `#${candidateId}` : ''}</h2>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/admin/surge')}>
          Back to dashboard
        </button>
      </div>

      <ErrorAlert error={error} onRetry={load} />

      {candidate && (
        <>
          <SurgeEvidencePanel candidate={candidate} event={event} />

          {candidate.status === 'PENDING' && (
            <section className="card">
              <h3>Review</h3>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                Optional note (e.g. “duplicate scenario”, “known test exercise”, “insufficient evidence”)
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  rows={2}
                  style={{ display: 'block', width: '100%' }}
                  disabled={busy}
                />
              </label>
              <button
                type="button"
                className="btn btn-success"
                disabled={busy}
                onClick={() => review('confirm')}
              >
                {busy ? 'Working…' : 'Confirm Operational Surge'}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ marginLeft: '0.5rem' }}
                disabled={busy}
                onClick={() => review('reject')}
              >
                {busy ? 'Working…' : 'Reject Candidate'}
              </button>
            </section>
          )}
        </>
      )}
    </div>
  );
}
