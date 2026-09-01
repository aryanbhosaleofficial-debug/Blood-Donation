import React, { useState, useEffect, useCallback } from 'react';
import { surgeApi } from '../../api/surge.api.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { InfoBanner } from '../../components/common/InfoBanner.jsx';
import { Button } from '../../components/common/Button.jsx';
import { MetricCard } from '../../components/common/MetricCard.jsx';
import { SurgeCandidateCard } from '../../components/admin/SurgeCandidateCard.jsx';
import { SurgeFilterForm } from '../../components/admin/SurgeFilterForm.jsx';
import { SurgeStatusBadge } from '../../components/admin/SurgeStatusBadge.jsx';
import { Activity, RefreshCw, AlertTriangle, ShieldCheck, XCircle, Zap } from 'lucide-react';

/**
 * Admin surge dashboard (Module 09).
 *
 * Shows unusual blood-demand candidates awaiting review and confirmed
 * operational surge events. It does NOT predict disasters — every candidate
 * needs a human administrator to confirm or reject it.
 */
export function SurgeDashboardPage() {
  const [candidates, setCandidates] = useState([]);
  const [events, setEvents] = useState([]);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cRes, eRes] = await Promise.all([
        surgeApi.getCandidates({ ...filters, limit: 100 }),
        surgeApi.getEvents({ limit: 100 }),
      ]);
      setCandidates(cRes.candidates || []);
      setEvents(eRes.events || []);
    } catch (err) {
      setError(err);
      setCandidates([]);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const counts = candidates.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});

  const activeEventsCount = events.filter((e) => e.status === 'ACTIVE').length;

  return (
    <div className="page-container">
      <PageHeader
        title="Surge Detection"
        description="Statistical anomaly detection engine for identifying regional spikes in red-cell emergency requests."
        actions={
          <Button variant="secondary" onClick={load} icon={<RefreshCw size={14} />}>
            Refresh Signals
          </Button>
        }
      />

      <InfoBanner variant="info">
        <strong>Surveillance Context:</strong> The detector flags statistical deviations from regional demand baselines. A confirmed surge is an internal operational coordination state — it does not confirm a disaster or determine external causes.
      </InfoBanner>

      {/* Summary Stat Cards */}
      <div className="dashboard-stats-grid">
        <MetricCard
          label="Pending Review"
          value={counts.PENDING || 0}
          subtext="Candidates awaiting decision"
          icon={<AlertTriangle size={18} />}
        />
        <MetricCard
          label="Confirmed Candidates"
          value={counts.CONFIRMED || 0}
          subtext="Operational surges verified"
          icon={<ShieldCheck size={18} />}
        />
        <MetricCard
          label="Rejected Signals"
          value={counts.REJECTED || 0}
          subtext="Marked as routine or noise"
          icon={<XCircle size={18} />}
        />
        <MetricCard
          label="Active Surge Events"
          value={activeEventsCount}
          subtext="Currently under active monitoring"
          icon={<Zap size={18} />}
        />
      </div>

      <SurgeFilterForm onApply={setFilters} disabled={loading} />
      <ErrorAlert error={error} onRetry={load} />

      {/* Surge Candidates Table */}
      <div className="card">
        <div className="card-header">
          <h3>Detected Anomaly Candidates ({candidates.length})</h3>
        </div>

        {loading ? (
          <LoadingSpinner message="Loading surge candidates…" />
        ) : candidates.length === 0 ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No surge candidates match the current filters.
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>City</th>
                  <th>Group</th>
                  <th>Observed</th>
                  <th>Expected</th>
                  <th>Upper-tail p</th>
                  <th>Hospitals</th>
                  <th>Score</th>
                  <th>Status</th>
                  <th>Detected</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <SurgeCandidateCard key={c.id} candidate={c} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Active Surge Events Table */}
      <div className="card">
        <div className="card-header">
          <h3>Active Operational Surge Events ({events.length})</h3>
        </div>

        {events.length === 0 ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No confirmed surge events recorded.
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Event ID</th>
                  <th>Candidate</th>
                  <th>City</th>
                  <th>Blood Group</th>
                  <th>Status</th>
                  <th>Confirmed At</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td><strong>#{e.id}</strong></td>
                    <td>#{e.candidateId}</td>
                    <td>{e.city}</td>
                    <td>{e.bloodGroup} / {e.component}</td>
                    <td><SurgeStatusBadge status={e.status} isSynthetic={e.isSynthetic} /></td>
                    <td>{e.confirmedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
