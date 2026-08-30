import React, { useState, useCallback } from 'react';
import { requestsApi } from '../../api/requests.api.js';
import { IncomingRequestCard } from '../../components/blood-bank/IncomingRequestCard.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { usePolling } from '../../hooks/usePolling.js';

export function IncomingRequestsPage() {
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

  usePolling(fetchIncoming, 3000, true);

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Incoming Emergency Requests</h2>
      </div>

      <div className="disclaimer-box">
        Updates automatically via background polling (~3s). Select an open request to review matching stock and reserve units.
      </div>

      <ErrorAlert error={error} onRetry={fetchIncoming} />

      {initialLoading ? (
        <LoadingSpinner message="Polling incoming broadcast requests…" />
      ) : requests.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: '2.5rem' }}>
          <p>No open emergency requests broadcast to your blood bank right now.</p>
        </div>
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
