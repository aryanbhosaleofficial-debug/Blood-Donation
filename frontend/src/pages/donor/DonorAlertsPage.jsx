import React, { useState, useEffect, useCallback } from 'react';
import { donorApi } from '../../api/donor.api.js';
import { AlertCard } from '../../components/donor/AlertCard.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';

export function DonorAlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await donorApi.getAlerts();
      setAlerts(data?.alerts || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleDismiss = async (alertId) => {
    try {
      await donorApi.dismissAlert(alertId);
      await loadAlerts();
    } catch (err) {
      setError(err);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Potential Donor Alerts</h2>
      </div>

      <div className="disclaimer-box">
        Emergency alerts are notifications of urgent red-cell requests from verified hospitals. A response indicates willingness to travel and does not guarantee medical eligibility.
      </div>

      <ErrorAlert error={error} onRetry={loadAlerts} />

      {loading ? (
        <LoadingSpinner message="Loading emergency alerts…" />
      ) : alerts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: '2.5rem' }}>
          <p>No active potential donor alerts at this time.</p>
        </div>
      ) : (
        <div className="request-list">
          {alerts.map((a) => (
            <AlertCard key={a.id} alert={a} onDismiss={handleDismiss} />
          ))}
        </div>
      )}
    </div>
  );
}
