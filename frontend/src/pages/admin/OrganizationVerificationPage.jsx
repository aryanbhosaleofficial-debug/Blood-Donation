import React, { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../api/admin.api.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { InfoBanner } from '../../components/common/InfoBanner.jsx';
import { ShieldCheck, CheckCircle2, XCircle, Building2, RefreshCw } from 'lucide-react';
import { useToast } from '../../components/common/ToastContext.jsx';

export function OrganizationVerificationPage() {
  const [pending, setPending] = useState([]);
  const [verified, setVerified] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const toast = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const [pendingRes, verifiedRes] = await Promise.all([
        adminApi.getPendingOrganizations(),
        adminApi.getVerifiedOrganizations(),
      ]);
      setPending(pendingRes.organizations || []);
      setVerified(verifiedRes.organizations || []);
    } catch (err) {
      setActionError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleVerify = async (userId) => {
    setBusyId(userId);
    setActionError(null);
    try {
      await adminApi.verifyOrganization(userId);
      toast.success('Organization verified successfully.');
      await loadData();
    } catch (err) {
      setActionError(err);
      toast.error('Failed to verify organization.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRevoke = async (userId) => {
    if (!window.confirm('Are you sure you want to revoke verification for this organization?')) {
      return;
    }
    setBusyId(userId);
    setActionError(null);
    try {
      await adminApi.revokeOrganization(userId);
      toast.info('Organization verification revoked.');
      await loadData();
    } catch (err) {
      setActionError(err);
      toast.error('Failed to revoke verification.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading organizations…" />;
  }

  return (
    <div className="page-container">
      <PageHeader
        title="Organization Governance &amp; Verification"
        description="Verify legitimate hospitals and blood-bank facilities to authorize them for emergency broadcasts and stock reservations."
        actions={
          <Button variant="secondary" onClick={loadData} icon={<RefreshCw size={14} />}>
            Refresh Queue
          </Button>
        }
      />

      <InfoBanner variant="info">
        <strong>Trust &amp; Compliance Protocol:</strong> Only verified healthcare facilities may post emergency red-cell broadcast requests or hold allocations. License references should be validated against state medical records.
      </InfoBanner>

      <ErrorAlert error={actionError} onRetry={loadData} />

      {/* Pending Organizations Queue */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Building2 size={18} style={{ color: 'var(--color-warning)' }} />
            Pending Verification Queue ({pending.length})
          </h3>
          <span className="badge" style={{ backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)', border: '1px solid var(--color-warning-border)' }}>
            Requires Review
          </span>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Organization Name</th>
                <th>Role</th>
                <th>Registration / License</th>
                <th>City</th>
                <th>Contact Email</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {pending.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-6)' }}>
                    No pending organizations awaiting verification.
                  </td>
                </tr>
              ) : (
                pending.map((org) => (
                  <tr key={org.userId}>
                    <td>
                      <strong>{org.organizationName || '—'}</strong>
                    </td>
                    <td>
                      <StatusBadge status={org.role} />
                    </td>
                    <td>{org.identityReference || '—'}</td>
                    <td>{org.city || '—'}</td>
                    <td>{org.email}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Button
                        variant="success"
                        size="sm"
                        disabled={busyId === org.userId}
                        onClick={() => handleVerify(org.userId)}
                        icon={<CheckCircle2 size={13} />}
                      >
                        {busyId === org.userId ? 'Verifying…' : 'Verify'}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Verified Organizations */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <ShieldCheck size={18} style={{ color: 'var(--color-success)' }} />
            Verified Network Facilities ({verified.length})
          </h3>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Organization Name</th>
                <th>Role</th>
                <th>Registration / License</th>
                <th>City</th>
                <th>Contact Email</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {verified.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-6)' }}>
                    No verified organizations found.
                  </td>
                </tr>
              ) : (
                verified.map((org) => (
                  <tr key={org.userId}>
                    <td>
                      <strong>{org.organizationName || '—'}</strong>
                    </td>
                    <td>
                      <StatusBadge status={org.role} />
                    </td>
                    <td>{org.identityReference || '—'}</td>
                    <td>{org.city || '—'}</td>
                    <td>{org.email}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={busyId === org.userId}
                        onClick={() => handleRevoke(org.userId)}
                        icon={<XCircle size={13} />}
                      >
                        {busyId === org.userId ? 'Revoking…' : 'Revoke'}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
