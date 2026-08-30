import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { requestsApi } from '../../api/requests.api.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { HospitalAllocationList } from '../../components/hospital/HospitalAllocationList.jsx';
import { DonorFallbackStatus } from '../../components/hospital/DonorFallbackStatus.jsx';
import { DonorPledgeList } from '../../components/hospital/DonorPledgeList.jsx';
import { formatDateTime } from '../../utils/dates.js';

export function RequestDetailPage() {
  const { requestId } = useParams();

  const [requestData, setRequestData] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [pledgeData, setPledgeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  const loadAll = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    setActionError(null);
    try {
      const [reqRes, allocRes, pledgeRes] = await Promise.all([
        requestsApi.getRequest(requestId),
        requestsApi.getRequestAllocations(requestId),
        requestsApi.getRequestPledges(requestId),
      ]);
      setRequestData(reqRes);
      setAllocations(allocRes?.allocations || []);
      setPledgeData(pledgeRes);
    } catch (err) {
      setActionError(err);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleActivateFallback = async () => {
    setActionBusy(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await requestsApi.activateDonorFallback(requestId);
      setActionSuccess(`Potential donor alerts assigned: ${result.totalActiveAlerts}`);
      await loadAll();
    } catch (err) {
      setActionError(err);
    } finally {
      setActionBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this emergency request?')) {
      return;
    }
    setActionBusy(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await requestsApi.cancelRequest(requestId);
      setActionSuccess('Request cancelled.');
      await loadAll();
    } catch (err) {
      setActionError(err);
    } finally {
      setActionBusy(false);
    }
  };

  const handleComplete = async () => {
    setActionBusy(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await requestsApi.completeRequest(requestId);
      setActionSuccess('Request marked as completed.');
      await loadAll();
    } catch (err) {
      setActionError(err);
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading request details…" />;
  }

  if (!requestData || !requestData.request) {
    return (
      <div className="page-container">
        <ErrorAlert error={actionError || 'Request not found.'} onRetry={loadAll} />
        <Link to="/hospital/requests" className="btn btn-secondary">
          Back to My Requests
        </Link>
      </div>
    );
  }

  const r = requestData.request;
  const broadcast = requestData.broadcast;

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Emergency Request #{r.id}</h2>
        <Link to="/hospital/requests" className="btn btn-secondary">
          Back to My Requests
        </Link>
      </div>

      <ErrorAlert error={actionError} onRetry={loadAll} />
      {actionSuccess && <div className="form-success">{actionSuccess}</div>}

      <div className="card">
        <h3>Request Overview</h3>
        <div className="row">
          <span className="k">Status</span>
          <span className="v">
            <StatusBadge status={r.status} isPastExpiry={r.isPastExpiry} />
          </span>
        </div>
        <div className="row">
          <span className="k">Blood Group</span>
          <span className="v"><strong>{r.bloodGroup}</strong></span>
        </div>
        <div className="row">
          <span className="k">Component</span>
          <span className="v">{r.component}</span>
        </div>
        <div className="row">
          <span className="k">Units Needed</span>
          <span className="v">{r.unitsNeeded}</span>
        </div>
        <div className="row">
          <span className="k">Allocated by Blood Banks</span>
          <span className="v">{r.bankUnitsAllocated}</span>
        </div>
        <div className="row">
          <span className="k">Remaining Needed Units</span>
          <span className="v"><strong>{r.remainingBankUnits}</strong></span>
        </div>
        <div className="row">
          <span className="k">Urgency</span>
          <span className="v">{r.urgency}</span>
        </div>
        {r.note && (
          <div className="row">
            <span className="k">Note</span>
            <span className="v">{r.note}</span>
          </div>
        )}
        <div className="row">
          <span className="k">Created At</span>
          <span className="v">{formatDateTime(r.createdAt)}</span>
        </div>
        <div className="row">
          <span className="k">Expires At</span>
          <span className="v">{formatDateTime(r.expiresAt)}</span>
        </div>
        {r.closedAt && (
          <div className="row">
            <span className="k">Closed At</span>
            <span className="v">{formatDateTime(r.closedAt)}</span>
          </div>
        )}
        <div className="row">
          <span className="k">Participating Banks Broadcast</span>
          <span className="v">{broadcast?.bankCount ?? '—'} bank(s)</span>
        </div>

        {r.status === 'COVERED' && (
          <div className="disclaimer-box" style={{ marginTop: '1rem' }}>
            Coverage target reached by participating blood banks. Clinical cross-matching and delivery coordination remain in progress.
          </div>
        )}

        <div className="form-actions">
          {r.status === 'OPEN' && r.remainingBankUnits > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={actionBusy}
              onClick={handleActivateFallback}
            >
              {actionBusy ? 'Activating…' : 'Activate Potential Donor Fallback'}
            </button>
          )}

          {(r.status === 'OPEN' || r.status === 'COVERED') && (
            <button
              type="button"
              className="btn btn-danger"
              disabled={actionBusy}
              onClick={handleCancel}
            >
              Cancel Request
            </button>
          )}

          {r.status === 'COVERED' && (
            <button
              type="button"
              className="btn btn-success"
              disabled={actionBusy}
              onClick={handleComplete}
            >
              Mark Completed
            </button>
          )}
        </div>
      </div>

      <HospitalAllocationList allocations={allocations} />

      <DonorFallbackStatus fallbackInfo={r.donorFallback} />

      <DonorPledgeList data={pledgeData} />
    </div>
  );
}
