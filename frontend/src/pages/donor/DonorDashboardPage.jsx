import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { donorApi } from '../../api/donor.api.js';
import { pledgesApi } from '../../api/pledges.api.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { MetricCard } from '../../components/common/MetricCard.jsx';
import { BloodGroupBadge } from '../../components/common/BloodGroupBadge.jsx';
import { InfoBanner } from '../../components/common/InfoBanner.jsx';
import { Bell, ShieldCheck, Activity, User, HeartHandshake, ArrowRight } from 'lucide-react';

export function DonorDashboardPage() {
  const [profile, setProfile] = useState(null);
  const [activeAlertsCount, setActiveAlertsCount] = useState(0);
  const [activePledgesCount, setActivePledgesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [profileRes, alertsRes, pledgesRes] = await Promise.all([
          donorApi.getProfile().catch(() => null),
          donorApi.getAlerts().catch(() => ({ alerts: [] })),
          pledgesApi.getPledges().catch(() => ({ pledges: [] })),
        ]);

        setProfile(profileRes?.donor || null);
        const alerts = alertsRes?.alerts || [];
        setActiveAlertsCount(alerts.filter((a) => a.isActionable).length);

        const pledges = pledgesRes?.pledges || [];
        setActivePledgesCount(
          pledges.filter((p) => ['PLEDGED', 'ARRIVED'].includes(p.status)).length,
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <LoadingSpinner message="Loading donor dashboard…" />;
  }

  return (
    <div className="page-container">
      <PageHeader
        title="Community Donor Workspace"
        description="Review active emergency blood-matching notifications, manage response pledges, and configure contact availability."
        actions={
          profile?.bloodGroup && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <BloodGroupBadge bloodGroup={profile.bloodGroup} size="lg" />
            </div>
          )
        }
      />

      {/* Summary Metrics */}
      <div className="dashboard-stats-grid">
        <MetricCard
          label="Profile Status"
          value={profile ? 'Complete' : 'Incomplete'}
          subtext={profile ? `Registered as ${profile.bloodGroup}` : 'Profile setup required'}
          icon={<User size={20} />}
        />

        <MetricCard
          label="Effective Availability"
          value={profile?.effectiveAvailability || 'Unknown'}
          subtext={profile?.effectiveAvailability === 'AVAILABLE' ? 'Ready for urgent matching' : 'Notifications suppressed'}
          icon={<Activity size={20} />}
        />

        <MetricCard
          label="Active Emergency Alerts"
          value={activeAlertsCount}
          subtext={activeAlertsCount > 0 ? 'Urgent requests requiring response' : 'No pending notifications'}
          icon={<Bell size={20} />}
        />

        <MetricCard
          label="Active Response Pledges"
          value={activePledgesCount}
          subtext={activePledgesCount > 0 ? 'Active coordination in progress' : 'No active pledges'}
          icon={<ShieldCheck size={20} />}
        />
      </div>

      <InfoBanner variant="info">
        <strong>Community Coordination Notice:</strong> Matching identifies potential compatibility for emergency hospital sourcing. A pledge communicates your readiness to travel; final suitability and health clearance are determined by healthcare staff at the collection facility.
      </InfoBanner>

      {/* Quick Navigation Cards */}
      <div className="card">
        <div className="card-header">
          <h3>Donor Actions</h3>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Link to="/donor/alerts" className="btn btn-emergency">
            <Bell size={16} /> View Emergency Alerts ({activeAlertsCount})
          </Link>
          <Link to="/donor/pledges" className="btn btn-secondary">
            <ShieldCheck size={16} /> My Response Pledges ({activePledgesCount})
          </Link>
          <Link to="/donor/availability" className="btn btn-secondary">
            <Activity size={16} /> Update Availability
          </Link>
          <Link to="/donor/profile" className="btn btn-secondary">
            <User size={16} /> Edit Profile
          </Link>
        </div>
      </div>
    </div>
  );
}
