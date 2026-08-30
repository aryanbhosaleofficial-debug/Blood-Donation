import React, { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../api/admin.api.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';

export function OrganizationVerificationPage() {
  const [pending, setPending] = useState([]);
  const [verified, setVerified] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState(null);
  const [busyId, setBusyId] = useState(null);

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
      await loadData();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusyId(null);
    }
  };

  const handleRevoke = async (userId) => {
    setBusyId(userId);
    setActionError(null);
    try {
      await adminApi.revokeOrganization(userId);
      await loadData();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading organizations…" />;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Organization Verification</h2>
      </div>

      <ErrorAlert error={actionError} onRetry={loadData} />

      <div className="card">
        <h3>Pending Organizations ({pending.length})</h3>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Organization Name</th>
                <th>Role</th>
                <th>Registration / License</th>
                <th>City</th>
                <th>Email</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pending.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--muted)' }}>
                    No pending organizations.
                  </td>
                </tr>
              ) : (
                pending.map((org) => (
                  <tr key={org.userId}>
                    <td>
                      <strong>{org.organizationName || '—'}</strong>
                    </td>
                    <td>{org.role}</td>
                    <td>{org.identityReference || '—'}</td>
                    <td>{org.city || '—'}</td>
                    <td>{org.email}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-success"
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.85rem' }}
                        disabled={busyId === org.userId}
                        onClick={() => handleVerify(org.userId)}
                      >
                        {busyId === org.userId ? 'Verifying…' : 'Verify'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>Verified Organizations ({verified.length})</h3>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Organization Name</th>
                <th>Role</th>
                <th>Registration / License</th>
                <th>City</th>
                <th>Email</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {verified.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--muted)' }}>
                    No verified organizations.
                  </td>
                </tr>
              ) : (
                verified.map((org) => (
                  <tr key={org.userId}>
                    <td>
                      <strong>{org.organizationName || '—'}</strong>
                    </td>
                    <td>{org.role}</td>
                    <td>{org.identityReference || '—'}</td>
                    <td>{org.city || '—'}</td>
                    <td>{org.email}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.85rem' }}
                        disabled={busyId === org.userId}
                        onClick={() => handleRevoke(org.userId)}
                      >
                        {busyId === org.userId ? 'Revoking…' : 'Revoke'}
                      </button>
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
