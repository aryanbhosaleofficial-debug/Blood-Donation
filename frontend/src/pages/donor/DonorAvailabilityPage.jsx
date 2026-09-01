import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { donorApi } from '../../api/donor.api.js';
import { AvailabilityControl } from '../../components/donor/AvailabilityControl.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { InfoBanner } from '../../components/common/InfoBanner.jsx';
import { UserPlus } from 'lucide-react';

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
      <PageHeader
        title="Donor Contact Availability"
        description="Set whether the platform may notify you of urgent regional red-cell requirements matching your blood group."
      />

      <ErrorAlert error={error} onRetry={loadProfile} />

      {profile ? (
        <AvailabilityControl profile={profile} onChange={handleChange} />
      ) : (
        <div className="card">
          <InfoBanner variant="warning" style={{ marginBottom: 'var(--space-4)' }}>
            Please create your donor profile before setting availability preferences.
          </InfoBanner>
          <Link to="/donor/profile" className="btn btn-primary">
            <UserPlus size={16} /> Create Donor Profile
          </Link>
        </div>
      )}
    </div>
  );
}
