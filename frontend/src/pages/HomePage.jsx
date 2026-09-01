import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { healthApi } from '../api/health.api.js';
import { HeartHandshake, ShieldCheck, Activity, ArrowRight, Server, Database, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader.jsx';
import { Button } from '../components/common/Button.jsx';
import { StatusBadge } from '../components/common/StatusBadge.jsx';

export function HomePage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await healthApi.getHealth();
        if (active) setHealth(data);
      } catch (err) {
        if (active) setHealthError(err && err.message ? err.message : 'Health check failed');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleGoToDashboard = () => {
    if (!user) return;
    switch (user.role) {
      case 'HOSPITAL':
        navigate('/hospital');
        break;
      case 'BLOOD_BANK':
        navigate('/blood-bank');
        break;
      case 'DONOR':
        navigate('/donor');
        break;
      case 'ADMIN':
        navigate('/admin/organizations');
        break;
      default:
        break;
    }
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Community Blood Donation Matching System"
        description="Emergency red-cell sourcing platform connecting verified hospitals, participating blood banks, and registered potential donors."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
        {/* Welcome / Action Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="card-header">
              <h3>{isAuthenticated && user ? `Welcome, ${user.email}` : 'Access Platform'}</h3>
              {isAuthenticated && user && <StatusBadge status={user.role} />}
            </div>

            {isAuthenticated && user ? (
              <div>
                <p style={{ marginBottom: 'var(--space-4)' }}>
                  You are currently authenticated with the <strong>{user.role}</strong> role. Access your operational workspace to coordinate emergency requests, inventory, or response pledges.
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginTop: 'var(--space-6)' }}>
                  <Button variant="primary" onClick={handleGoToDashboard} icon={<ArrowRight size={16} />}>
                    Go to {user.role} Workspace
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ marginBottom: 'var(--space-4)' }}>
                  Sign in with your organization account or donor profile to participate in real-time blood coordination, inventory reservation, and emergency alert matching.
                </p>
                <div style={{ marginTop: 'var(--space-6)' }}>
                  <Link to="/login" className="btn btn-primary" style={{ display: 'inline-flex' }}>
                    Sign in to your account
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: 'var(--space-6)',
              paddingTop: 'var(--space-4)',
              borderTop: '1px solid var(--color-border)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-muted)',
            }}
          >
            Emergency coordination tool. Final donor suitability and transfusion screening are conducted by hospital laboratory staff.
          </div>
        </div>

        {/* System & Infrastructure Status */}
        <div className="card">
          <div className="card-header">
            <h3>Infrastructure Health</h3>
            {health && <span className="status-badge status-open">Operational</span>}
          </div>

          {healthError ? (
            <p style={{ color: 'var(--color-error)' }}>System status: {healthError}</p>
          ) : health ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="row">
                <span className="k" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Server size={14} /> Backend API Status
                </span>
                <span className="v" style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={14} /> {health.status || 'ok'}
                </span>
              </div>
              <div className="row">
                <span className="k" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Database size={14} /> Database Connection
                </span>
                <span className="v">{health.db || 'Supabase PostgreSQL'}</span>
              </div>
              <div className="row">
                <span className="k">Schema Version</span>
                <span className="v">v{health.schemaVersion ?? '6'}</span>
              </div>
              <div className="row">
                <span className="k">Security Mode</span>
                <span className="v">Session & CSRF Protected</span>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--color-text-muted)' }}>Checking platform health…</p>
          )}
        </div>
      </div>
    </div>
  );
}
