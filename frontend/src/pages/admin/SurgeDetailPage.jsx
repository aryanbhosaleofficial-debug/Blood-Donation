import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { surgeApi } from '../../api/surge.api.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { Button } from '../../components/common/Button.jsx';
import { SurgeEvidencePanel } from '../../components/admin/SurgeEvidencePanel.jsx';
import { ArrowLeft, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import { useToast } from '../../components/common/ToastContext.jsx';

const CONFIRM_DIALOG =
  'This confirms an unusual blood-demand surge for operational monitoring. '
  + 'It does not confirm the external cause.';

/**
 * Admin surge candidate detail + review actions (Module 09).
 */
export function SurgeDetailPage() {
  const { candidateId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

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
      toast.success(kind === 'confirm' ? 'Operational surge confirmed.' : 'Candidate rejected.');
    } catch (err) {
      setError(err);
      toast.error('Failed to submit review decision.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading surge candidate…" />;

  return (
    <div className="page-container">
      <PageHeader
        title={`Surge Anomaly Candidate ${candidateId ? `#${candidateId}` : ''}`}
        description="Inspect statistical anomaly indicators, baseline comparison data, and evaluate operational surge status."
        actions={
          <Button
            variant="secondary"
            onClick={() => navigate('/admin/surge')}
            icon={<ArrowLeft size={16} />}
          >
            Back to Dashboard
          </Button>
        }
      />

      <ErrorAlert error={error} onRetry={load} />

      {candidate && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <SurgeEvidencePanel candidate={candidate} event={event} />

          {candidate.status === 'PENDING' && (
            <section className="card">
              <div className="card-header">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <ShieldCheck size={18} style={{ color: 'var(--color-primary-800)' }} />
                  Administrator Review Decision
                </h3>
              </div>

              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label htmlFor="surge-review-note">
                  Optional Review Note (e.g. “duplicate scenario”, “known test exercise”, “insufficient evidence”)
                </label>
                <textarea
                  id="surge-review-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  rows={3}
                  disabled={busy}
                  placeholder="Add context for this review decision…"
                />
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <Button
                  variant="success"
                  disabled={busy}
                  loading={busy}
                  onClick={() => review('confirm')}
                  icon={<CheckCircle2 size={16} />}
                >
                  {busy ? 'Working…' : 'Confirm Operational Surge'}
                </Button>

                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() => review('reject')}
                  icon={<XCircle size={16} />}
                >
                  {busy ? 'Working…' : 'Reject Candidate'}
                </Button>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
