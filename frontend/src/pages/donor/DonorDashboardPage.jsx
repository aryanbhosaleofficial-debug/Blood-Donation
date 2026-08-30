import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { donorApi } from '../../api/donor.api.js';
import { pledgesApi } from '../../api/pledges.api.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';

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
      <div className="page-header">
        <h2>Donor Dashboard</h2>
      </div>

      <div className="dashboard-stats-grid">
        <div className="stat-card">
          <div className="stat-label">Profile Status</div>
          <div className="stat-value" style={{ fontSize: '1.1rem' }}>
            {profile ? 'Complete' : 'Incomplete'}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Effective Availability</div>
          <div className="stat-value" style={{ fontSize: '1.1rem' }}>
            {profile?.effectiveAvailability || 'Unknown'}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Active Emergency Alerts</div>
          <div className="stat-value" style={{ color: activeAlertsCount > 0 ? 'var(--accent)' : 'inherit' }}>
            {activeAlertsCount}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Active Response Pledges</div>
          <div className="stat-value" style={{ color: activePledgesCount > 0 ? 'var(--info)' : 'inherit' }}>
            {activePledgesCount}
          </div>
        </div>
      </div>

      <div className="disclaimer-box">
        A pledge indicates willingness to respond and travel to the hospital. All donors undergo independent medical screening and testing at the facility prior to donation.
      </div>

      <div className="card">
        <h3>Quick Actions</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Link to="/donor/alerts" className="btn btn-primary">
            View Emergency Alerts ({activeAlertsCount})
          </Link>
          <Link to="/donor/pledges" className="btn btn-secondary">
            My Pledges ({activePledgesCount})
          </Link>
          <Link to="/donor/availability" className="btn btn-secondary">
            Update Availability
          </Link>
          <Link to="/donor/profile" className="btn btn-secondary">
            Edit Profile
          </Link>
        </div>
      </div>
    </div>
  );
}
