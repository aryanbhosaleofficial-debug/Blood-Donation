import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { pledgesApi } from '../../api/pledges.api.js';
import { PledgeControl } from '../../components/donor/PledgeControl.jsx';
import { LocationSharingControl } from '../../components/donor/LocationSharingControl.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { BloodGroupBadge } from '../../components/common/BloodGroupBadge.jsx';
import { UrgencyBadge } from '../../components/common/UrgencyBadge.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { formatDateTime } from '../../utils/dates.js';
import { ArrowLeft, Building2, MapPin, ShieldCheck, Clock } from 'lucide-react';

export function DonorPledgeDetailPage() {
  const { pledgeId } = useParams();

  const [pledge, setPledge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadPledge = useCallback(async () => {
    if (!pledgeId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await pledgesApi.getPledgeDetail(pledgeId);
      setPledge(data?.pledge || null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [pledgeId]);

  useEffect(() => {
    loadPledge();
  }, [loadPledge]);

  const handleCancelPledge = async () => {
    await pledgesApi.cancelPledge(pledgeId);
    await loadPledge();
  };

  const handleArrivePledge = async () => {
    await pledgesApi.arrivePledge(pledgeId);
    await loadPledge();
  };

  const handleStartLocation = async (coords) => {
    await pledgesApi.shareLocation(pledgeId, coords);
    await loadPledge();
  };

  const handleStopLocation = async () => {
    await pledgesApi.stopLocation(pledgeId);
    await loadPledge();
  };

  if (loading) {
    return <LoadingSpinner message="Loading pledge details…" />;
  }

  if (!pledge) {
    return (
      <div className="page-container">
        <ErrorAlert error={error || 'Pledge not found.'} onRetry={loadPledge} />
        <Link to="/donor/pledges" className="btn btn-secondary">
          <ArrowLeft size={16} /> Back to My Pledges
        </Link>
      </div>
    );
  }

  const hospital = pledge.hospital || {};
  const hospitalLocation = [hospital.locality, hospital.city].filter(Boolean).join(', ') || '—';

  return (
    <div className="page-container">
      <PageHeader
        title={`Pledge ${pledge.publicReference}`}
        description="Manage active arrival status and privacy-controlled temporary location sharing for this emergency response."
        actions={
          <Link to="/donor/pledges" className="btn btn-secondary">
            <ArrowLeft size={16} /> Back to My Pledges
          </Link>
        }
      />

      <ErrorAlert error={error} onRetry={loadPledge} />

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <BloodGroupBadge bloodGroup={pledge.request?.bloodGroup} size="lg" />
            <h3 style={{ margin: 0 }}>
              Response Pledge #{pledge.publicReference}
            </h3>
            {pledge.request?.urgency && <UrgencyBadge urgency={pledge.request.urgency} />}
          </div>
          <StatusBadge status={pledge.status} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)', margin: 'var(--space-4) 0' }}>
          <div>
            <div className="row"><span className="k">Public Reference</span><span className="v"><strong>{pledge.publicReference}</strong></span></div>
            <div className="row"><span className="k">Hospital Destination</span><span className="v"><strong>{hospital.name || 'Hospital'}</strong></span></div>
            <div className="row"><span className="k">Hospital Locality</span><span className="v">{hospitalLocation}</span></div>
          </div>
          <div>
            <div className="row"><span className="k">Requested Blood Group</span><span className="v">{pledge.request?.bloodGroup} (Red Cells)</span></div>
            <div className="row"><span className="k">Urgency Priority</span><span className="v">{pledge.request?.urgency}</span></div>
            <div className="row"><span className="k">Pledged Timestamp</span><span className="v">{formatDateTime(pledge.pledgedAt)}</span></div>
          </div>
        </div>

        <PledgeControl
          pledge={pledge}
          onCancel={handleCancelPledge}
          onArrive={handleArrivePledge}
        />
      </div>

      {['PLEDGED', 'ARRIVED'].includes(pledge.status) && (
        <LocationSharingControl
          pledge={pledge}
          onStart={handleStartLocation}
          onStop={handleStopLocation}
        />
      )}
    </div>
  );
}
