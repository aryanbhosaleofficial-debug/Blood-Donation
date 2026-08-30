import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { hospitalApi } from '../../api/hospital.api.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';

export function HospitalDashboardPage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await hospitalApi.getProfile();
        setProfile(data);
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <LoadingSpinner message="Loading hospital dashboard…" />;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Hospital Dashboard</h2>
      </div>

      <div className="card">
        <h3>Organization Status</h3>
        {profile ? (
          <div>
            <p>
              <strong>{profile.name}</strong> —{' '}
              <StatusBadge status={profile.isVerified ? 'verified' : 'pending'} />{' '}
              {profile.isVerified ? (
                <span>Verified organization</span>
              ) : (
                <span style={{ color: 'var(--warning)' }}>
                  Pending verification (you cannot post requests yet)
                </span>
              )}
            </p>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
              {profile.locality ? `${profile.locality}, ` : ''}
              {profile.city} · Contact: {profile.contactName} ({profile.contactPhone})
            </p>
          </div>
        ) : (
          <div>
            <p style={{ color: 'var(--warning)' }}>
              You have not created a hospital profile yet. Please complete your profile to coordinate emergency requests.
            </p>
            <Link to="/hospital/profile" className="btn btn-primary">
              Create Hospital Profile
            </Link>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Quick Actions</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Link to="/hospital/requests/new" className="btn btn-primary">
            Create Emergency Request
          </Link>
          <Link to="/hospital/requests" className="btn btn-secondary">
            View My Requests
          </Link>
          <Link to="/hospital/profile" className="btn btn-secondary">
            Manage Hospital Profile
          </Link>
        </div>
      </div>
    </div>
  );
}
