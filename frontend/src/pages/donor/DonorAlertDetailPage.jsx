import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { donorApi } from '../../api/donor.api.js';
import { pledgesApi } from '../../api/pledges.api.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { BloodGroupBadge } from '../../components/common/BloodGroupBadge.jsx';
import { UrgencyBadge } from '../../components/common/UrgencyBadge.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { Button } from '../../components/common/Button.jsx';
import { InfoBanner } from '../../components/common/InfoBanner.jsx';
import { formatDateTime } from '../../utils/dates.js';
import { ArrowLeft, Building2, MapPin, Clock, Heart, ShieldCheck } from 'lucide-react';
import { useToast } from '../../components/common/ToastContext.jsx';

export function DonorAlertDetailPage() {
  const { alertId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pledging, setPledging] = useState(false);
  const [actionError, setActionError] = useState(null);

  const loadAlert = useCallback(async () => {
    if (!alertId) return;
    setLoading(true);
    setActionError(null);

    try {
      const data = await donorApi.getAlertDetail(alertId);
      const alertObj = data?.alert;
      setAlert(alertObj);

      if (alertObj?.status === 'ACTIVE') {
        await donorApi.viewAlert(alertId);
      }
    } catch (err) {
      setActionError(err);
    } finally {
      setLoading(false);
    }
  }, [alertId]);

  useEffect(() => {
    loadAlert();
  }, [loadAlert]);

  const handlePledge = async () => {
    setPledging(true);
    setActionError(null);

    try {
      const result = await pledgesApi.createPledge(alertId);
      toast.success('Pledge registered successfully. Hospital notified of response.');
      if (result && result.pledge) {
        navigate(`/donor/pledges/${result.pledge.id}`);
      }
    } catch (err) {
      const msg = err && err.message ? err.message : 'Failed to record pledge.';
      setActionError(msg);
      toast.error(msg);
    } finally {
      setPledging(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading alert details…" />;
  }

  if (!alert) {
    return (
      <div className="page-container">
        <ErrorAlert error={actionError || 'Alert not found.'} onRetry={loadAlert} />
        <Link to="/donor/alerts" className="btn btn-secondary">
          <ArrowLeft size={16} /> Back to Alerts
        </Link>
      </div>
    );
  }

  const hospital = alert.hospital || {};
  const hospitalLocation = [hospital.locality, hospital.city].filter(Boolean).join(', ') || '—';

  return (
    <div className="page-container">
      <PageHeader
        title="Potential Donor Alert"
        description="Review urgent red-cell requirement details from requesting hospital and record your willingness to respond."
        actions={
          <Link to="/donor/alerts" className="btn btn-secondary">
            <ArrowLeft size={16} /> Back to Alerts
          </Link>
        }
      />

      <ErrorAlert error={actionError} onRetry={loadAlert} />

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <BloodGroupBadge bloodGroup={alert.request?.bloodGroup} size="lg" />
            <h3 style={{ margin: 0 }}>
              Emergency Requirement · #{alert.request?.id || alert.id}
            </h3>
            {alert.request?.urgency && <UrgencyBadge urgency={alert.request.urgency} />}
          </div>
          <StatusBadge status={alert.status} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)', margin: 'var(--space-4) 0' }}>
          <div>
            <div className="row"><span className="k">Hospital Facility</span><span className="v">{hospital.name || 'Hospital'}</span></div>
            <div className="row"><span className="k">Hospital Locality</span><span className="v">{hospitalLocation}</span></div>
            <div className="row"><span className="k">Requested Blood Group</span><span className="v">{alert.request?.bloodGroup} (Red Cells)</span></div>
            <div className="row"><span className="k">Component</span><span className="v">Red Cells</span></div>
          </div>
          <div>
            <div className="row"><span className="k">Remaining Needed</span><span className="v"><strong>{alert.request?.remainingRequirement} unit(s)</strong></span></div>
            <div className="row"><span className="k">Urgency</span><span className="v">{alert.request?.urgency}</span></div>
            <div className="row"><span className="k">Request Created</span><span className="v">{formatDateTime(alert.request?.createdAt)}</span></div>
            <div className="row"><span className="k">Request Expires</span><span className="v">{formatDateTime(alert.request?.expiresAt)}</span></div>
          </div>
        </div>

        <InfoBanner variant="info" style={{ margin: 'var(--space-4) 0' }}>
          <strong>Pledge Commitment Protocol:</strong> A pledge indicates your readiness to travel to the facility. Final medical history screening, donor suitability evaluation, and blood testing occur at the hospital before donation.
        </InfoBanner>

        {alert.isActionable && (
          <div className="form-actions" style={{ marginTop: 'var(--space-4)' }}>
            <Button
              variant="emergency"
              size="lg"
              loading={pledging}
              disabled={pledging}
              onClick={handlePledge}
              icon={<Heart size={16} />}
            >
              {pledging ? 'Pledging Response…' : 'Pledge to Respond'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
