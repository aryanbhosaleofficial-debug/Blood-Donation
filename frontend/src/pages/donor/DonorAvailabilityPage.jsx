import React, { useState, useEffect, useCallback } from 'react';
import { donorApi } from '../../api/donor.api.js';
import { AvailabilityControl } from '../../components/donor/AvailabilityControl.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';

export function DonorAvailabilityPage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await donorApi.getProfile();
      setProfile(data?.donor || null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleChange = async (newStatus) => {
    const data = await donorApi.setAvailability(newStatus);
    const updated = data?.donor || data;
    setProfile(updated);
    return updated;
  };

  if (loading) {
    return <LoadingSpinner message="Loading availability…" />;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Donor Availability</h2>
      </div>

      <ErrorAlert error={error} onRetry={loadProfile} />

      {profile ? (
        <AvailabilityControl profile={profile} onChange={handleChange} />
      ) : (
        <div className="card">
          <p style={{ color: 'var(--warning)' }}>Please create your donor profile before setting availability.</p>
        </div>
      )}
    </div>
  );
}
