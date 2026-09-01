import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { pledgesApi } from '../../api/pledges.api.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { BloodGroupBadge } from '../../components/common/BloodGroupBadge.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { InfoBanner } from '../../components/common/InfoBanner.jsx';
import { formatDateTime } from '../../utils/dates.js';
import { ShieldCheck, Building2, Clock, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '../../components/common/Button.jsx';

export function DonorPledgesPage() {
  const [pledges, setPledges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadPledges = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await pledgesApi.getPledges();
      setPledges(data?.pledges || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPledges();
  }, [loadPledges]);

  return (
    <div className="page-container">
      <PageHeader
        title="My Response Pledges"
        description="Active and past response commitments for urgent red-cell requests. Manage temporary location sharing and arrival status."
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button variant="secondary" onClick={loadPledges} icon={<RefreshCw size={14} />}>
              Refresh
            </Button>
            <Link to="/donor/alerts" className="btn btn-emergency">
              View Alerts
            </Link>
          </div>
        }
      />

      <InfoBanner variant="info">
        <strong>Pledge Protocol:</strong> Pledges communicate your willingness to travel to the requesting hospital. Medical intake, donor history check, and blood testing are conducted on-site by laboratory staff.
      </InfoBanner>

      <ErrorAlert error={error} onRetry={loadPledges} />

      {loading ? (
        <LoadingSpinner message="Loading your pledges…" />
      ) : pledges.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck size={32} />}
          title="No Active Pledges"
          description="You have not pledged to any emergency blood requests yet."
          action={
            <Link to="/donor/alerts" className="btn btn-emergency">
              Check Active Emergency Alerts
            </Link>
          }
        />
      ) : (
        <div className="request-list">
          {pledges.map((p) => (
            <article key={p.id} className="request-card">
              <div className="request-card-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  <BloodGroupBadge bloodGroup={p.request?.bloodGroup} />
                  <strong>
                    Pledge {p.publicReference}
                  </strong>
                </div>
                <StatusBadge status={p.status} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                <Building2 size={15} style={{ color: 'var(--color-text-muted)' }} />
                <strong>{p.hospital?.name || 'Hospital'}</strong>
                <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                <span style={{ color: 'var(--color-text-secondary)' }}>
                  {p.hospital?.city || 'Location not shared'}
                </span>
              </div>

              <div className="request-card-meta">
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={13} /> Pledged: {formatDateTime(p.pledgedAt)}
                </span>
              </div>

              <div style={{ marginTop: 'var(--space-2)', display: 'flex', justifyContent: 'flex-end' }}>
                <Link
                  to={`/donor/pledges/${p.id}`}
                  className="btn btn-secondary btn-sm"
                >
                  Manage Pledge &amp; Location <ArrowRight size={13} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
