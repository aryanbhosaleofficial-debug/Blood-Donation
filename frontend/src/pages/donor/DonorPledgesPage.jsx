import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { pledgesApi } from '../../api/pledges.api.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { formatDateTime } from '../../utils/dates.js';

export function DonorPledgesPage() {
  const [pledges, setPledges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadPledges = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await pledgesApi.getPledges();
      setPledges(data?.pledges || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPledges();
  }, [loadPledges]);

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>My Potential Donor Pledges</h2>
        <Link to="/donor/alerts" className="btn btn-secondary">
          View Alerts
        </Link>
      </div>

      <div className="disclaimer-box">
        Pledges reflect commitments to respond and travel to the requesting facility for professional evaluation.
      </div>

      <ErrorAlert error={error} onRetry={loadPledges} />

      {loading ? (
        <LoadingSpinner message="Loading your pledges…" />
      ) : pledges.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: '2.5rem' }}>
          <p>You have not pledged to any emergency requests yet.</p>
          <Link to="/donor/alerts" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
            Check Active Emergency Alerts
          </Link>
        </div>
      ) : (
        <div className="request-list">
          {pledges.map((p) => (
            <article key={p.id} className="request-card">
              <div className="request-card-head">
                <strong>
                  {p.publicReference} · {p.request?.bloodGroup} Red Cells
                </strong>
                <StatusBadge status={p.status} />
              </div>

              <p className="request-card-meta">
                <strong>{p.hospital?.name || 'Hospital'}</strong> — {p.hospital?.city || ''}
              </p>

              <p className="request-card-meta">
                Pledged at {formatDateTime(p.pledgedAt)}
              </p>

              <div style={{ marginTop: '0.5rem' }}>
                <Link
                  to={`/donor/pledges/${p.id}`}
                  className="btn btn-secondary"
                  style={{ padding: '0.3rem 0.75rem', fontSize: '0.85rem' }}
                >
                  Manage Pledge & Location
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
