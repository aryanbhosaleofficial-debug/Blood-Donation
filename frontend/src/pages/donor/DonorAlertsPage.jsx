import React, { useState, useEffect, useCallback } from 'react';
import { donorApi } from '../../api/donor.api.js';
import { AlertCard } from '../../components/donor/AlertCard.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { InfoBanner } from '../../components/common/InfoBanner.jsx';
import { Button } from '../../components/common/Button.jsx';
import { Bell, RefreshCw } from 'lucide-react';
import { useToast } from '../../components/common/ToastContext.jsx';

export function DonorAlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const toast = useToast();

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
      toast.info('Alert dismissed.');
      await loadAlerts();
    } catch (err) {
      setError(err);
      toast.error('Failed to dismiss alert.');
    }
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Potential Donor Emergency Alerts"
        description="Active emergency notifications matched to your registered blood group from nearby verified hospital facilities."
        actions={
          <Button variant="secondary" onClick={loadAlerts} icon={<RefreshCw size={14} />}>
            Refresh Alerts
          </Button>
        }
      />

      <InfoBanner variant="info">
        <strong>Community Emergency Alerts:</strong> These alerts reflect urgent hospital needs. A pledge indicates your readiness to travel. Donor suitability, health evaluation, and blood testing occur at the donation facility.
      </InfoBanner>

      <ErrorAlert error={error} onRetry={loadAlerts} />

      {loading ? (
        <LoadingSpinner message="Loading emergency alerts…" />
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={<Bell size={32} />}
          title="No Emergency Alerts Right Now"
          description="There are currently no active emergency red-cell requests matching your registered blood group in your area."
        />
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
