import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { requestsApi } from '../../api/requests.api.js';
import { bloodBankApi } from '../../api/blood-bank.api.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { formatDateTime } from '../../utils/dates.js';

export function BloodBankRequestDetailPage() {
  const { requestId } = useParams();

  const [requestData, setRequestData] = useState(null);
  const [matchingStock, setMatchingStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  const loadDetail = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    setActionError(null);

    try {
      const [detailRes, invRes] = await Promise.all([
        requestsApi.getIncomingRequestDetail(requestId),
        bloodBankApi.getInventory(),
      ]);

      const req = detailRes?.request;
      setRequestData(req);

      if (req && invRes?.inventory) {
        const match = invRes.inventory.find(
          (item) => item.bloodGroup === req.bloodGroup && item.component === req.component,
        );
        setMatchingStock(match ? match.unitsAvailable : 0);
      }
    } catch (err) {
      setActionError(err);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleReserve = async () => {
    setReserving(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      await requestsApi.allocateRequest(requestId);
      setActionSuccess('Units allocated and reserved successfully from your inventory.');
      await loadDetail();
    } catch (err) {
      setActionError(err);
    } finally {
      setReserving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading incoming request…" />;
  }

  if (!requestData) {
    return (
      <div className="page-container">
        <ErrorAlert error={actionError || 'Request not found or not broadcast to your organization.'} onRetry={loadDetail} />
        <Link to="/blood-bank/requests" className="btn btn-secondary">
          Back to Incoming Requests
        </Link>
      </div>
    );
  }

  const r = requestData;
  const hosp = r.hospital || {};
  const hospLocation = [hosp.locality, hosp.city].filter(Boolean).join(', ') || '—';

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Incoming Emergency Request #{r.id}</h2>
        <Link to="/blood-bank/requests" className="btn btn-secondary">
          Back to Incoming Requests
        </Link>
      </div>

      <ErrorAlert error={actionError} onRetry={loadDetail} />
      {actionSuccess && <div className="form-success">{actionSuccess}</div>}

      <div className="card">
        <h3>Request & Inventory Match</h3>
        <div className="row">
          <span className="k">Blood Group</span>
          <span className="v"><strong>{r.bloodGroup}</strong></span>
        </div>
        <div className="row">
          <span className="k">Component</span>
          <span className="v">{r.component}</span>
        </div>
        <div className="row">
          <span className="k">Units Needed by Hospital</span>
          <span className="v">{r.unitsNeeded}</span>
        </div>
        <div className="row">
          <span className="k">Already Allocated by Banks</span>
          <span className="v">{r.bankUnitsAllocated}</span>
        </div>
        <div className="row">
          <span className="k">Remaining Required Units</span>
          <span className="v"><strong>{r.remainingBankUnits}</strong></span>
        </div>
        <div className="row">
          <span className="k">Your Bank Matching Stock</span>
          <span className="v" style={{ color: matchingStock > 0 ? 'var(--success)' : 'var(--accent)' }}>
            <strong>{matchingStock ?? 'Not configured'} unit(s)</strong>
          </span>
        </div>
        <div className="row">
          <span className="k">Urgency</span>
          <span className="v">{r.urgency}</span>
        </div>
        <div className="row">
          <span className="k">Request Status</span>
          <span className="v"><StatusBadge status={r.status} isPastExpiry={r.isPastExpiry} /></span>
        </div>
        <div className="row">
          <span className="k">Requesting Hospital</span>
          <span className="v"><strong>{hosp.name || 'Hospital'}</strong></span>
        </div>
        <div className="row">
          <span className="k">Hospital Location</span>
          <span className="v">{hospLocation}</span>
        </div>
        <div className="row">
          <span className="k">Created At</span>
          <span className="v">{formatDateTime(r.createdAt)}</span>
        </div>
        <div className="row">
          <span className="k">Expires At</span>
          <span className="v">{formatDateTime(r.expiresAt)}</span>
        </div>

        {r.ownAllocation && (
          <div className="row" style={{ background: 'var(--bg)', padding: '0.75rem', marginTop: '0.5rem', borderRadius: 'var(--radius)' }}>
            <span className="k">My Organization Allocation</span>
            <span className="v">
              <StatusBadge status={r.ownAllocation.status} /> · {r.ownAllocation.unitsReserved} unit(s) reserved
            </span>
          </div>
        )}

        <div className="form-actions">
          {!r.ownAllocation && r.status === 'OPEN' && r.remainingBankUnits > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={reserving || matchingStock === 0}
              onClick={handleReserve}
            >
              {reserving ? 'Reserving Stock…' : 'Reserve Maximum Safe Quantity'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
