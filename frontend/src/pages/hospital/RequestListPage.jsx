import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { requestsApi } from '../../api/requests.api.js';
import { RequestCard } from '../../components/hospital/RequestCard.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';

const STATUS_FILTERS = ['', 'OPEN', 'COVERED', 'COMPLETED', 'CANCELLED', 'EXPIRED'];

export function RequestListPage() {
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await requestsApi.listRequests(statusFilter || undefined);
      setRequests(data?.requests || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>My Emergency Requests</h2>
        <Link to="/hospital/requests/new" className="btn btn-primary">
          Create New Request
        </Link>
      </div>

      <div className="card" style={{ padding: '0.75rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <label htmlFor="status-filter" style={{ fontWeight: 500, fontSize: '0.9rem' }}>
            Filter by status:
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '0.4rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s || 'All Statuses'}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ErrorAlert error={error} onRetry={loadRequests} />

      {loading ? (
        <LoadingSpinner message="Loading emergency requests…" />
      ) : requests.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: '2.5rem' }}>
          <p>No emergency requests found.</p>
          <Link to="/hospital/requests/new" className="btn btn-secondary">
            Create an Emergency Request
          </Link>
        </div>
      ) : (
        <div className="request-list">
          {requests.map((r) => (
            <RequestCard key={r.id} request={r} />
          ))}
        </div>
      )}
    </div>
  );
}
