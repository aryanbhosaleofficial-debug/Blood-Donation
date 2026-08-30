import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { apiClient } from '../api/api-client.js';

export function HomePage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiClient.get('/health');
        setHealth(data);
      } catch (err) {
        setHealthError(err && err.message ? err.message : 'Health check failed');
      }
    })();
  }, []);

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Community Blood Donation Matching System</h2>
      </div>

      <div className="card">
        <h3>Welcome</h3>
        {isAuthenticated && user ? (
          <div>
            <p>
              Signed in as <strong>{user.email}</strong> ({user.role})
            </p>
            <div style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
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
                }}
              >
                Go to {user.role} Dashboard
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p>
              An emergency sourcing platform that connects verified hospitals with participating blood banks and registered potential donors for urgent red-cell requirements.
            </p>
            <div style={{ marginTop: '1rem' }}>
              <Link to="/login" className="btn btn-primary">
                Sign In to Your Account
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3>System Status</h3>
        {healthError ? (
          <p style={{ color: 'var(--accent)' }}>System status: {healthError}</p>
        ) : health ? (
          <div>
            <div className="row">
              <span className="k">Backend Status</span>
              <span className="v" style={{ color: 'var(--success)' }}>
                ● {health.status || 'ok'}
              </span>
            </div>
            <div className="row">
              <span className="k">Database</span>
              <span className="v">{health.db || 'ok'}</span>
            </div>
            <div className="row">
              <span className="k">Schema Version</span>
              <span className="v">{health.schemaVersion ?? '6'}</span>
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--muted)' }}>Checking backend health…</p>
        )}
      </div>
    </div>
  );
}
