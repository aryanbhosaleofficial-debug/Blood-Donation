import React, { useState, useEffect, useCallback } from 'react';
import { surgeApi } from '../../api/surge.api.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { SurgeCandidateCard } from '../../components/admin/SurgeCandidateCard.jsx';
import { SurgeFilterForm } from '../../components/admin/SurgeFilterForm.jsx';
import { SurgeStatusBadge } from '../../components/admin/SurgeStatusBadge.jsx';

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

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Surge Detection</h2>
        <button type="button" className="btn btn-secondary" onClick={load}>Refresh</button>
      </div>

      <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
        The detector flags unusual blood-demand patterns for review. A confirmed
        surge is an internal operational blood-demand state — it does not confirm
        a disaster or its external cause.
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', margin: '0.5rem 0 1rem' }}>
        <span className="card">Pending: <strong>{counts.PENDING || 0}</strong></span>
        <span className="card">Confirmed: <strong>{counts.CONFIRMED || 0}</strong></span>
        <span className="card">Rejected: <strong>{counts.REJECTED || 0}</strong></span>
        <span className="card">Active events: <strong>{events.filter((e) => e.status === 'ACTIVE').length}</strong></span>
      </div>

      <SurgeFilterForm onApply={setFilters} disabled={loading} />
      <ErrorAlert error={error} onRetry={load} />

      {loading ? (
        <LoadingSpinner message="Loading surge candidates…" />
      ) : candidates.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No surge candidates match the current filters.</p>
      ) : (
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>City</th><th>Group</th><th>Observed</th><th>Expected</th>
                <th>Upper-tail p</th><th>Hospitals</th><th>Score</th><th>Status</th><th>Detected</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => <SurgeCandidateCard key={c.id} candidate={c} />)}
            </tbody>
          </table>
        </div>
      )}

      <h3 style={{ marginTop: '1.5rem' }}>Active Surge Events</h3>
      {events.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No confirmed surge events.</p>
      ) : (
        <div className="table-responsive">
          <table>
            <thead>
              <tr><th>Event</th><th>Candidate</th><th>City</th><th>Group</th><th>Status</th><th>Confirmed at</th></tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>#{e.id}</td>
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
  );
}
