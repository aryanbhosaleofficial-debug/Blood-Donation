import React, { useState, useEffect, useCallback } from 'react';
import { metricsApi } from '../../api/metrics.api.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { MetricsSection } from '../../components/admin/MetricsSection.jsx';

/**
 * Admin operational metrics dashboard (Module 08).
 *
 * These are aggregate system counts for monitoring / CEP evaluation only.
 * They are NOT medical outcomes, guaranteed availability, or surge predictions.
 */
export function OperationalMetricsPage() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await metricsApi.getMetrics();
      setMetrics(res.metrics);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner message="Loading operational metrics…" />;

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Operational Metrics</h2>
        <button type="button" className="btn btn-secondary" onClick={load}>Refresh</button>
      </div>

      <ErrorAlert error={error} onRetry={load} />

      {metrics && (
        <>
          <MetricsSection
            title="Emergency Requests"
            note="Synthetic/demo requests are counted separately from real operational requests."
            items={[
              { label: 'Total', value: metrics.requests.total },
              { label: 'Open', value: metrics.requests.open },
              { label: 'Covered', value: metrics.requests.covered },
              { label: 'Completed', value: metrics.requests.completed },
              { label: 'Cancelled', value: metrics.requests.cancelled },
              { label: 'Expired', value: metrics.requests.expired },
              { label: 'Synthetic', value: metrics.requests.synthetic },
              { label: 'Non-synthetic', value: metrics.requests.nonSynthetic },
              { label: 'Critical', value: metrics.requests.byUrgency?.critical },
              { label: 'Urgent', value: metrics.requests.byUrgency?.urgent },
              { label: 'Normal', value: metrics.requests.byUrgency?.normal },
            ]}
          />

          <MetricsSection
            title="Recorded Bank Allocations"
            note="Reserved units are recorded coordination movement — not proof of transfused blood."
            items={[
              { label: 'Total', value: metrics.allocations.total },
              { label: 'Reserved', value: metrics.allocations.reserved },
              { label: 'Released', value: metrics.allocations.released },
              { label: 'Completed', value: metrics.allocations.completed },
              { label: 'Units reserved', value: metrics.allocations.totalUnitsReserved },
            ]}
          />

          <MetricsSection
            title="Recorded Red-Cell Inventory"
            note="Recorded inventory is not a guarantee of physical availability."
            items={[
              { label: 'Recorded units', value: metrics.inventory.totalRecordedRedCellUnits },
              { label: 'Stale rows', value: metrics.inventory.staleInventoryRows },
              { label: 'Fresh rows', value: metrics.inventory.freshInventoryRows },
            ]}
          />

          <MetricsSection
            title="Potential Donors"
            note="Potential donor profiles are not medically eligible donors."
            items={[
              { label: 'Profiles', value: metrics.donors.totalDonorProfiles },
              { label: 'Available for contact', value: metrics.donors.available },
              { label: 'Unavailable', value: metrics.donors.unavailable },
              { label: 'Unknown', value: metrics.donors.unknown },
              { label: 'Active alerts', value: metrics.donors.activeDonorAlerts },
            ]}
          />

          <MetricsSection
            title="Active Potential Donor Pledges"
            items={[
              { label: 'Active', value: metrics.pledges.active },
              { label: 'Arrived', value: metrics.pledges.arrived },
              { label: 'Cancelled', value: metrics.pledges.cancelled },
              { label: 'Expired', value: metrics.pledges.expired },
              { label: 'Deferred', value: metrics.pledges.deferred },
              { label: 'Closed', value: metrics.pledges.closed },
            ]}
          />

          <MetricsSection
            title="Notifications"
            items={[
              { label: 'Queued', value: metrics.notifications.queued },
              { label: 'Sent', value: metrics.notifications.sent },
              { label: 'Failed', value: metrics.notifications.failed },
              { label: 'Unread', value: metrics.notifications.unread },
            ]}
          />

          <MetricsSection
            title="Cleanup Workers"
            note="Operational health indicators for the background maintenance jobs."
            items={[
              { label: 'Past-due active requests', value: metrics.cleanup.pastDueActiveRequests },
              { label: 'Expired location sessions remaining', value: metrics.cleanup.expiredLocationSessionsRemaining },
              { label: 'Notification worker', value: metrics.workers.notification },
              { label: 'Request expiry worker', value: metrics.workers.requestExpiry },
              { label: 'Location cleanup worker', value: metrics.workers.locationCleanup },
            ]}
          />
        </>
      )}
    </div>
  );
}
