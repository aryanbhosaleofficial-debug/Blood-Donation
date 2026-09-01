import React, { useState, useEffect } from 'react';
import { donorApi } from '../../api/donor.api.js';
import { DonorProfileForm } from '../../components/donor/DonorProfileForm.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { InfoBanner } from '../../components/common/InfoBanner.jsx';
import { BloodGroupBadge } from '../../components/common/BloodGroupBadge.jsx';

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
  };

  if (loading) {
    return <LoadingSpinner message="Loading donor profile…" />;
  }

  return (
    <div className="page-container">
      <PageHeader
        title="Donor Profile &amp; Preferences"
        description="Manage your registered blood group, approximate geographic area for matching, and contact availability."
        actions={
          profile?.bloodGroup && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <BloodGroupBadge bloodGroup={profile.bloodGroup} size="lg" />
            </div>
          )
        }
      />

      <InfoBanner variant="info">
        <strong>Privacy Assurance:</strong> Your contact phone, email, and exact home address are strictly private and never exposed to requesting hospitals or third parties. Hospitals only see your pseudonymous reference and coarse travel ETA when you actively pledge.
      </InfoBanner>

      <ErrorAlert error={error} onRetry={loadProfile} />

      <div className="card">
        <div className="card-header">
          <h3>{profile ? 'Edit Donor Profile' : 'Create Donor Profile'}</h3>
        </div>
        <DonorProfileForm profile={profile} onSubmit={handleSave} />
      </div>
    </div>
  );
}
