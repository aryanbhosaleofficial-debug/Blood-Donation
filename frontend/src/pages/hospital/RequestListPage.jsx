import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { requestsApi } from '../../api/requests.api.js';
import { RequestCard } from '../../components/hospital/RequestCard.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { Plus, Filter, Droplets, RefreshCw } from 'lucide-react';
import { Button } from '../../components/common/Button.jsx';

const STATUS_FILTERS = [
  { value: '', label: 'All Statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'COVERED', label: 'Covered' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'EXPIRED', label: 'Expired' },
];

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
      <PageHeader
        title="My Emergency Requests"
        description="Track all posted red-cell requests, real-time blood-bank reservations, and potential donor fallback responses."
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button variant="secondary" onClick={loadRequests} icon={<RefreshCw size={14} />}>
              Refresh
            </Button>
            <Link to="/hospital/requests/new" className="btn btn-emergency">
              <Plus size={16} /> Create New Request
            </Link>
          </div>
        }
      />

      {/* Filter Toolbar */}
      <div className="card" style={{ padding: 'var(--space-4) var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <Filter size={16} style={{ color: 'var(--color-text-muted)' }} />
            <label htmlFor="status-filter" style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
              Filter by status:
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ minHeight: 36, padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-strong)' }}
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Showing <strong>{requests.length}</strong> {requests.length === 1 ? 'request' : 'requests'}
          </div>
        </div>
      </div>

      <ErrorAlert error={error} onRetry={loadRequests} />

      {loading ? (
        <LoadingSpinner message="Loading emergency requests…" />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={<Droplets size={32} />}
          title="No Emergency Requests Found"
          description={
            statusFilter
              ? `There are no requests matching the "${statusFilter}" status filter.`
              : 'You have not created any emergency red-cell requests yet.'
          }
          action={
            <Link to="/hospital/requests/new" className="btn btn-emergency">
              <Plus size={16} /> Create an Emergency Request
            </Link>
          }
        />
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
