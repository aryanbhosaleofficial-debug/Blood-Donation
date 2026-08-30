import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { donorApi } from '../../api/donor.api.js';
import { pledgesApi } from '../../api/pledges.api.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { formatDateTime } from '../../utils/dates.js';

export function DonorAlertDetailPage() {
  const { alertId } = useParams();
  const navigate = useNavigate();

  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pledging, setPledging] = useState(false);
  const [actionError, setActionError] = useState(null);

  const loadAlert = useCallback(async () => {
    if (!alertId) return;
    setLoading(true);
    setActionError(null);

    try {
      let data = await donorApi.getAlertDetail(alertId);
      let alertObj = data?.alert;

      if (alertObj?.status === 'ACTIVE') {
        const viewedData = await donorApi.viewAlert(alertId);
        alertObj = viewedData?.alert || alertObj;
      }

      setAlert(alertObj);
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
      if (result && result.pledge) {
        navigate(`/donor/pledges/${result.pledge.id}`);
      }
    } catch (err) {
      setActionError(err);
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
          Back to Alerts
        </Link>
      </div>
    );
  }

  const hospital = alert.hospital || {};
  const hospitalLocation = [hospital.locality, hospital.city].filter(Boolean).join(', ') || '—';

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Potential Donor Alert</h2>
        <Link to="/donor/alerts" className="btn btn-secondary">
          Back to Alerts
        </Link>
      </div>

      <ErrorAlert error={actionError} onRetry={loadAlert} />

      <div className="card">
        <h3>Emergency Requirement</h3>
        <div className="row">
          <span className="k">Alert Status</span>
          <span className="v"><StatusBadge status={alert.status} /></span>
        </div>
        <div className="row">
          <span className="k">Requested Blood Group</span>
          <span className="v"><strong>{alert.request?.bloodGroup}</strong></span>
        </div>
        <div className="row">
          <span className="k">Component</span>
          <span className="v">Red Cells</span>
        </div>
        <div className="row">
          <span className="k">Urgency</span>
          <span className="v">{alert.request?.urgency}</span>
        </div>
        <div className="row">
          <span className="k">Remaining Needed</span>
          <span className="v"><strong>{alert.request?.remainingRequirement} unit(s)</strong></span>
        </div>
        <div className="row">
          <span className="k">Hospital Facility</span>
          <span className="v"><strong>{hospital.name || 'Hospital'}</strong></span>
        </div>
        <div className="row">
          <span className="k">Hospital Location</span>
          <span className="v">{hospitalLocation}</span>
        </div>
        <div className="row">
          <span className="k">Request Created</span>
          <span className="v">{formatDateTime(alert.request?.createdAt)}</span>
        </div>
        <div className="row">
          <span className="k">Request Expires</span>
          <span className="v">{formatDateTime(alert.request?.expiresAt)}</span>
        </div>

        <div className="disclaimer-box" style={{ marginTop: '1.25rem' }}>
          A pledge indicates your willingness to travel to the donation facility. Final medical screening, donor safety evaluation, and blood testing will be performed at the facility.
        </div>

        {alert.isActionable && (
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={pledging}
              onClick={handlePledge}
            >
              {pledging ? 'Pledging Response…' : 'Pledge to Respond'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
