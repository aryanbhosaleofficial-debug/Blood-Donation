import React, { useState, useCallback } from 'react';
import { requestsApi } from '../../api/requests.api.js';
import { IncomingRequestCard } from '../../components/blood-bank/IncomingRequestCard.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { InfoBanner } from '../../components/common/InfoBanner.jsx';
import { usePolling } from '../../hooks/usePolling.js';
import { useAuth } from '../../hooks/useAuth.js';
import { Radio, Droplets, RefreshCw } from 'lucide-react';
import { Button } from '../../components/common/Button.jsx';

export function IncomingRequestsPage() {
  const { authStatus } = useAuth();
  const [requests, setRequests] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchIncoming = useCallback(async () => {
    try {
      const data = await requestsApi.getIncomingRequests();
      setRequests(data?.requests || []);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  usePolling(fetchIncoming, 3000, authStatus === 'authenticated');

  return (
    <div className="page-container">
      <PageHeader
        title="Incoming Broadcast Requests"
        description="Real-time stream of emergency red-cell requirements broadcast from verified regional hospitals."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-success)',
                fontWeight: 600,
                padding: '0.25rem 0.65rem',
                backgroundColor: 'var(--color-success-bg)',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--color-success-border)',
              }}
            >
              <Radio size={12} className="animate-pulse" /> Live polling (3s)
            </span>
            <Button variant="secondary" size="sm" onClick={fetchIncoming} icon={<RefreshCw size={13} />}>
              Refresh
            </Button>
          </div>
        }
      />

      <InfoBanner variant="info">
        <strong>Broadcast Hold Protocol:</strong> Open requests broadcast to all verified blood banks in the facility cluster. Review matching inventory to reserve available units before request expiration.
      </InfoBanner>

      <ErrorAlert error={error} onRetry={fetchIncoming} />

      {initialLoading ? (
        <LoadingSpinner message="Polling incoming broadcast requests…" />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={<Droplets size={32} />}
          title="No Open Broadcast Requests"
          description="There are currently no active emergency red-cell requests broadcast to your facility."
        />
      ) : (
        <div className="request-list">
          {requests.map((r) => (
            <IncomingRequestCard key={r.id} request={r} />
          ))}
        </div>
      )}
    </div>
  );
}
