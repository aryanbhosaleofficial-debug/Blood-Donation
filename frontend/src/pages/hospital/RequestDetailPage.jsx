import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { requestsApi } from '../../api/requests.api.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { BloodGroupBadge } from '../../components/common/BloodGroupBadge.jsx';
import { UrgencyBadge } from '../../components/common/UrgencyBadge.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { Button } from '../../components/common/Button.jsx';
import { InfoBanner } from '../../components/common/InfoBanner.jsx';
import { ConfirmDialog } from '../../components/common/ConfirmDialog.jsx';
import { HospitalAllocationList } from '../../components/hospital/HospitalAllocationList.jsx';
import { DonorFallbackStatus } from '../../components/hospital/DonorFallbackStatus.jsx';
import { DonorPledgeList } from '../../components/hospital/DonorPledgeList.jsx';
import { formatDateTime } from '../../utils/dates.js';
import { ArrowLeft, Users, CheckCircle2, XCircle, Clock, Building2, RefreshCw } from 'lucide-react';
import { useToast } from '../../components/common/ToastContext.jsx';

export function RequestDetailPage() {
  const { requestId } = useParams();
  const toast = useToast();

  const [requestData, setRequestData] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [pledgeData, setPledgeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

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
      const msg = `Potential donor alerts assigned: ${result.totalActiveAlerts}`;
      setActionSuccess(msg);
      toast.success(msg);
      await loadAll();
    } catch (err) {
      setActionError(err);
      toast.error('Failed to activate donor fallback.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleCancel = async () => {
    setActionBusy(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await requestsApi.cancelRequest(requestId);
      setActionSuccess('Request cancelled.');
      toast.info('Emergency request cancelled.');
      setShowCancelDialog(false);
      await loadAll();
    } catch (err) {
      setActionError(err);
      toast.error('Failed to cancel request.');
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
      toast.success('Request completed.');
      await loadAll();
    } catch (err) {
      setActionError(err);
      toast.error('Failed to complete request.');
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
          <ArrowLeft size={16} /> Back to My Requests
        </Link>
      </div>
    );
  }

  const r = requestData.request;
  const broadcast = requestData.broadcast;
  const allocated = r.bankUnitsAllocated ?? 0;
  const needed = r.unitsNeeded;
  const remaining = r.remainingBankUnits ?? needed;
  const pct = Math.min(100, Math.round((allocated / (needed || 1)) * 100));

  return (
    <div className="page-container">
      <PageHeader
        title={`Emergency Request #${r.id}`}
        description="Live operational command for blood-bank allocation hold, fallback donor assignment, and delivery coordination."
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button variant="secondary" onClick={loadAll} icon={<RefreshCw size={14} />}>
              Refresh
            </Button>
            <Link to="/hospital/requests" className="btn btn-secondary">
              <ArrowLeft size={16} /> Back to My Requests
            </Link>
          </div>
        }
      />

      <ErrorAlert error={actionError} onRetry={loadAll} />
      {actionSuccess && (
        <div className="form-success" role="status">
          <CheckCircle2 size={16} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Main Request Command Card */}
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

        {/* Coverage Progress Indicator */}
        <div className="coverage-progress-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            <span>
              Bank allocation coverage: <strong>{allocated} of {needed} units</strong> ({pct}%)
            </span>
            <span>
              Remaining needed: <strong>{remaining} {remaining === 1 ? 'unit' : 'units'}</strong>
            </span>
          </div>
          <div className="coverage-progress-bar" style={{ height: 10 }}>
            <div
              className={`coverage-progress-fill ${pct === 100 ? 'full' : ''}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {r.status === 'COVERED' && (
          <InfoBanner variant="info" style={{ margin: 'var(--space-4) 0' }}>
            <strong>Coverage Target Reached:</strong> Required units are reserved across participating blood banks. Delivery logistics and clinical cross-matching are active.
          </InfoBanner>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)', margin: 'var(--space-4) 0' }}>
          <div>
            <div className="row"><span className="k">Request ID</span><span className="v">#{r.id}</span></div>
            <div className="row"><span className="k">Blood Group</span><span className="v">{r.bloodGroup}</span></div>
            <div className="row"><span className="k">Component</span><span className="v">{r.component}</span></div>
            <div className="row"><span className="k">Units Needed</span><span className="v">{r.unitsNeeded}</span></div>
            <div className="row"><span className="k">Bank Allocations</span><span className="v">{r.bankUnitsAllocated}</span></div>
          </div>
          <div>
            <div className="row"><span className="k">Remaining Required</span><span className="v">{r.remainingBankUnits}</span></div>
            <div className="row"><span className="k">Urgency Priority</span><span className="v">{r.urgency}</span></div>
            <div className="row"><span className="k">Created At</span><span className="v">{formatDateTime(r.createdAt)}</span></div>
            <div className="row"><span className="k">Expires At</span><span className="v">{formatDateTime(r.expiresAt)}</span></div>
            <div className="row"><span className="k">Participating Banks</span><span className="v">{broadcast?.bankCount ?? '—'} notified</span></div>
          </div>
        </div>

        {r.note && (
          <div style={{ backgroundColor: 'var(--color-surface-subtle)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', margin: 'var(--space-3) 0', border: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>
              Delivery &amp; Logistical Instructions
            </span>
            <p style={{ color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
              {r.note}
            </p>
          </div>
        )}

        {/* Action Controls */}
        <div className="form-actions">
          {r.status === 'OPEN' && r.remainingBankUnits > 0 && (
            <Button
              variant="emergency"
              disabled={actionBusy}
              loading={actionBusy}
              onClick={handleActivateFallback}
              icon={<Users size={16} />}
            >
              Activate Potential Donor Fallback
            </Button>
          )}

          {r.status === 'COVERED' && (
            <Button
              variant="success"
              disabled={actionBusy}
              loading={actionBusy}
              onClick={handleComplete}
              icon={<CheckCircle2 size={16} />}
            >
              Mark Completed
            </Button>
          )}

          {(r.status === 'OPEN' || r.status === 'COVERED') && (
            <Button
              variant="danger"
              disabled={actionBusy}
              onClick={() => {
                if (window.confirm && window.confirm('Are you sure you want to cancel this emergency request?')) {
                  handleCancel();
                }
              }}
              icon={<XCircle size={16} />}
            >
              Cancel Request
            </Button>
          )}
        </div>
      </div>

      {/* Allocation List from Blood Banks */}
      <HospitalAllocationList allocations={allocations} />

      {/* Potential Donor Fallback Status */}
      <DonorFallbackStatus fallbackInfo={r.donorFallback} />

      {/* Potential Donor Pledges */}
      <DonorPledgeList data={pledgeData} />
    </div>
  );
}
