import React, { useState, useEffect } from 'react';
import { donorApi } from '../../api/donor.api.js';
import { DonorProfileForm } from '../../components/donor/DonorProfileForm.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';

export function DonorProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await donorApi.getProfile();
      setProfile(data?.donor || null);
    } catch (err) {
      if (err.status !== 404) {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSave = async (payload) => {
    let saved;
    if (profile) {
      saved = await donorApi.updateProfile(payload);
    } else {
      saved = await donorApi.createProfile(payload);
    }
    setProfile(saved?.donor || saved);
    return saved;
  };

  if (loading) {
    return <LoadingSpinner message="Loading donor profile…" />;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Donor Profile</h2>
      </div>

      <div className="disclaimer-box">
        Your contact details and approximate location are private and strictly protected. They are never shared directly with hospitals.
      </div>

      <ErrorAlert error={error} onRetry={loadProfile} />

      <div className="card">
        <h3>{profile ? 'Edit Private Donor Profile' : 'Create Private Donor Profile'}</h3>
        <DonorProfileForm profile={profile} onSubmit={handleSave} />
      </div>
    </div>
  );
}
