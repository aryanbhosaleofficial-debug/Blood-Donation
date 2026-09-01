import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { hospitalApi } from '../../api/hospital.api.js';
import { requestsApi } from '../../api/requests.api.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { MetricCard } from '../../components/common/MetricCard.jsx';
import { Button } from '../../components/common/Button.jsx';
import { InfoBanner } from '../../components/common/InfoBanner.jsx';
import { Plus, ClipboardList, Building2, Droplets, AlertTriangle, ShieldCheck, Clock } from 'lucide-react';

export function HospitalDashboardPage() {
  const [profile, setProfile] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [profileData, reqData] = await Promise.all([
          hospitalApi.getProfile().catch(() => null),
          requestsApi.listRequests().catch(() => ({ requests: [] })),
        ]);
        setProfile(profileData);
        setRequests(reqData?.requests || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <LoadingSpinner message="Loading hospital dashboard…" />;
  }

  const activeRequests = requests.filter((r) => r.status === 'OPEN');
  const coveredRequests = requests.filter((r) => r.status === 'COVERED');
  const criticalRequests = requests.filter((r) => r.status === 'OPEN' && r.urgency === 'CRITICAL');

  return (
    <div className="page-container">
      <PageHeader
        title="Hospital Operations Dashboard"
        description="Monitor active red-cell emergency requests, coordinate blood-bank allocations, and manage facility verification."
        actions={
          profile?.isVerified ? (
            <Link to="/hospital/requests/new" className="btn btn-emergency">
              <Plus size={16} /> Create Emergency Request
            </Link>
          ) : null
        }
      />

      {/* Facility Status Card */}
      <div className="card">
        <div className="card-header">
          <h3>Facility Status</h3>
          {profile && <StatusBadge status={profile.isVerified ? 'verified' : 'pending'} />}
        </div>

        {profile ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: profile.isVerified ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                  color: profile.isVerified ? 'var(--color-success)' : 'var(--color-warning)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Building2 size={22} />
              </div>
              <div>
                <strong style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-text-primary)' }}>
                  {profile.name}
                </strong>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
                  {profile.locality ? `${profile.locality}, ` : ''}{profile.city} · License: {profile.registrationReference || '—'}
                </p>
              </div>
            </div>

            {!profile.isVerified && (
              <InfoBanner variant="warning" style={{ marginTop: 'var(--space-4)' }}>
                <strong>Verification Pending:</strong> Your organization profile is awaiting administrator verification before emergency broadcast requests can be posted.
              </InfoBanner>
            )}
          </div>
        ) : (
          <div>
            <InfoBanner variant="warning" style={{ marginBottom: 'var(--space-4)' }}>
              You have not created a hospital profile yet. Please complete your facility profile to coordinate emergency requests.
            </InfoBanner>
            <Link to="/hospital/profile" className="btn btn-primary">
              Create Hospital Profile
            </Link>
          </div>
        )}
      </div>

      {/* Summary Metrics */}
      <div className="dashboard-stats-grid">
        <MetricCard
          label="Active Open Requests"
          value={activeRequests.length}
          subtext={`${criticalRequests.length} critical priority`}
          icon={<Droplets size={20} />}
        />
        <MetricCard
          label="Covered by Banks"
          value={coveredRequests.length}
          subtext="Awaiting completion / delivery"
          icon={<ShieldCheck size={20} />}
        />
        <MetricCard
          label="Total Logged Requests"
          value={requests.length}
          subtext="All historical requests"
          icon={<ClipboardList size={20} />}
        />
      </div>

      {/* Quick Navigation Cards */}
      <div className="card">
        <div className="card-header">
          <h3>Quick Actions</h3>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Link to="/hospital/requests/new" className="btn btn-emergency">
            <Plus size={16} /> Create Emergency Request
          </Link>
          <Link to="/hospital/requests" className="btn btn-secondary">
            <ClipboardList size={16} /> View My Requests ({requests.length})
          </Link>
          <Link to="/hospital/profile" className="btn btn-secondary">
            <Building2 size={16} /> Manage Hospital Profile
          </Link>
        </div>
      </div>
    </div>
  );
}
