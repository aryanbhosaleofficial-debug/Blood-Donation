import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { requestsApi } from '../../api/requests.api.js';
import { bloodBankApi } from '../../api/blood-bank.api.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { BloodGroupBadge } from '../../components/common/BloodGroupBadge.jsx';
import { UrgencyBadge } from '../../components/common/UrgencyBadge.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { Button } from '../../components/common/Button.jsx';
import { InfoBanner } from '../../components/common/InfoBanner.jsx';
import { formatDateTime } from '../../utils/dates.js';
import { ArrowLeft, Building2, PackageCheck, CheckCircle2, MapPin, Clock } from 'lucide-react';
import { useToast } from '../../components/common/ToastContext.jsx';

export function BloodBankRequestDetailPage() {
  const { requestId } = useParams();
  const toast = useToast();

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
      const msg = 'Units allocated and reserved successfully from your inventory.';
      setActionSuccess(msg);
      toast.success(msg);
      await loadDetail();
    } catch (err) {
      setActionError(err);
      toast.error('Failed to reserve units for this request.');
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
          <ArrowLeft size={16} /> Back to Incoming Requests
        </Link>
      </div>
    );
  }

  const r = requestData;
  const hosp = r.hospital || {};
  const hospLocation = [hosp.locality, hosp.city].filter(Boolean).join(', ') || '—';

  return (
    <div className="page-container">
      <PageHeader
        title={`Incoming Emergency Request #${r.id}`}
        description="Review hospital demand details against your available cold-storage stock and allocate units."
        actions={
          <Link to="/blood-bank/requests" className="btn btn-secondary">
            <ArrowLeft size={16} /> Back to Incoming Requests
          </Link>
        }
      />

      <ErrorAlert error={actionError} onRetry={loadDetail} />
      {actionSuccess && (
        <div className="form-success" role="status">
          <CheckCircle2 size={16} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Sourcing Match Overview Card */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <BloodGroupBadge bloodGroup={r.bloodGroup} size="lg" />
            <h3 style={{ margin: 0 }}>
              {r.unitsNeeded} {r.unitsNeeded === 1 ? 'Unit' : 'Units'} of {r.component}
            </h3>
            <UrgencyBadge urgency={r.urgency} />
          </div>
          <StatusBadge status={r.status} isPastExpiry={r.isPastExpiry} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)', margin: 'var(--space-4) 0' }}>
          <div>
            <div className="row"><span className="k">Requesting Hospital</span><span className="v">{hosp.name || 'Hospital'}</span></div>
            <div className="row"><span className="k">Hospital Location</span><span className="v">{hospLocation}</span></div>
            <div className="row"><span className="k">Blood Group</span><span className="v">{r.bloodGroup}</span></div>
            <div className="row"><span className="k">Component</span><span className="v">{r.component}</span></div>
            <div className="row"><span className="k">Units Required by Hospital</span><span className="v">{r.unitsNeeded}</span></div>
          </div>
          <div>
            <div className="row"><span className="k">Remaining Needed Across Network</span><span className="v">{r.remainingBankUnits}</span></div>
            <div className="row">
              <span className="k">Your Matching Recorded Stock</span>
              <span
                className="v"
                style={{
                  color: matchingStock > 0 ? 'var(--color-success)' : 'var(--color-error)',
                  fontWeight: 700,
                }}
              >
                {matchingStock ?? 'Not configured'} {matchingStock === 1 ? 'unit' : 'units'}
              </span>
            </div>
            <div className="row"><span className="k">Request Urgency</span><span className="v">{r.urgency}</span></div>
            <div className="row"><span className="k">Broadcast Created</span><span className="v">{formatDateTime(r.createdAt)}</span></div>
            <div className="row"><span className="k">Broadcast Expires</span><span className="v">{formatDateTime(r.expiresAt)}</span></div>
          </div>
        </div>

        {r.ownAllocation && (
          <div
            style={{
              backgroundColor: 'var(--color-success-bg)',
              border: '1px solid var(--color-success-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
              margin: 'var(--space-4) 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <PackageCheck size={20} style={{ color: 'var(--color-success)' }} />
              <div>
                <strong style={{ color: 'var(--color-success-hover)', fontSize: 'var(--font-size-base)', display: 'block' }}>
                  Units Reserved by Your Facility
                </strong>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {r.ownAllocation.unitsReserved} {r.ownAllocation.unitsReserved === 1 ? 'unit' : 'units'} currently allocated under Hold status.
                </span>
              </div>
            </div>
            <StatusBadge status={r.ownAllocation.status} />
          </div>
        )}

        <div className="form-actions">
          {!r.ownAllocation && r.status === 'OPEN' && r.remainingBankUnits > 0 && (
            <Button
              variant="emergency"
              size="lg"
              disabled={reserving || matchingStock === 0}
              loading={reserving}
              onClick={handleReserve}
              icon={<PackageCheck size={16} />}
            >
              {reserving ? 'Reserving Stock…' : 'Reserve Maximum Safe Quantity'}
            </Button>
          )}

          {matchingStock === 0 && !r.ownAllocation && (
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-error)' }}>
              Your facility has 0 units of recorded {r.bloodGroup} stock available.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
