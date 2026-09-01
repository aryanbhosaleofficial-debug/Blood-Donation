import React, { useState, useEffect } from 'react';
import { bloodBankApi } from '../../api/blood-bank.api.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { Button } from '../../components/common/Button.jsx';
import { InfoBanner } from '../../components/common/InfoBanner.jsx';
import { Building2, Save, MapPin, Phone, User, CheckCircle2 } from 'lucide-react';
import { useToast } from '../../components/common/ToastContext.jsx';

export function BloodBankProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const toast = useToast();

  const [formData, setFormData] = useState({
    name: '',
    licenseNo: '',
    contactName: '',
    contactPhone: '',
    address: '',
    city: '',
    locality: '',
    pinCode: '',
    latitude: '',
    longitude: '',
  });

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await bloodBankApi.getProfile();
      if (data) {
        setProfile(data);
        setFormData({
          name: data.name || '',
          licenseNo: data.licenseNo || '',
          contactName: data.contactName || '',
          contactPhone: data.contactPhone || '',
          address: data.address || '',
          city: data.city || '',
          locality: data.locality || '',
          pinCode: data.pinCode || '',
          latitude: data.latitude ?? '',
          longitude: data.longitude ?? '',
        });
      }
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      name: formData.name.trim(),
      contactName: formData.contactName.trim(),
      contactPhone: formData.contactPhone.trim(),
      address: formData.address.trim(),
      city: formData.city.trim(),
      locality: formData.locality ? formData.locality.trim() : null,
      pinCode: formData.pinCode ? formData.pinCode.trim() : null,
      latitude: formData.latitude !== '' ? Number(formData.latitude) : null,
      longitude: formData.longitude !== '' ? Number(formData.longitude) : null,
    };

    if (!profile?.isVerified) {
      payload.licenseNo = formData.licenseNo.trim();
    }

    try {
      let saved;
      if (profile) {
        saved = await bloodBankApi.updateProfile(payload);
      } else {
        saved = await bloodBankApi.createProfile(payload);
      }
      setProfile(saved);
      setSuccess('Blood bank profile saved successfully.');
      toast.success('Blood bank profile saved successfully.');
    } catch (err) {
      setError(err);
      toast.error('Failed to save blood bank profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading blood bank profile…" />;
  }

  return (
    <div className="page-container">
      <PageHeader
        title="Blood Bank Facility Profile"
        description="Maintain facility licensing, contact information, and geographic location for regional emergency coordination."
        actions={
          profile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <StatusBadge status={profile.isVerified ? 'verified' : 'pending'} />
            </div>
          )
        }
      />

      <ErrorAlert error={error} onRetry={loadProfile} />
      {success && (
        <div className="form-success" role="status">
          <CheckCircle2 size={16} />
          <span>{success}</span>
        </div>
      )}

      {profile?.isVerified ? (
        <InfoBanner variant="info">
          <strong>Verified Blood Bank:</strong> License number is locked while verified. Contact system admin for formal organization updates.
        </InfoBanner>
      ) : (
        <InfoBanner variant="warning">
          <strong>Verification Required:</strong> Ensure legal license details are accurate for admin authorization to participate in broadcasts.
        </InfoBanner>
      )}

      <div className="card">
        <div className="card-header">
          <h3>{profile ? 'Edit Blood Bank Profile' : 'Create Blood Bank Profile'}</h3>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {/* Section 1: Facility Details */}
            <div>
              <h4 style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Building2 size={16} /> Organization &amp; Licensing
              </h4>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="bank-name">Blood Bank Name *</label>
                  <input
                    id="bank-name"
                    name="name"
                    type="text"
                    required
                    disabled={saving}
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g. Central City Blood Center"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="bank-license">License Number *</label>
                  <input
                    id="bank-license"
                    name="licenseNo"
                    type="text"
                    required
                    disabled={saving || Boolean(profile?.isVerified)}
                    value={formData.licenseNo}
                    onChange={handleChange}
                    placeholder="e.g. LIC-BB-2026-908"
                  />
                  {profile?.isVerified && (
                    <span className="form-hint">Locked for verified organizations.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Section 2: Primary Contact */}
            <div>
              <h4 style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <User size={16} /> Contact Details
              </h4>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="bank-contact-name">Contact Person Name *</label>
                  <input
                    id="bank-contact-name"
                    name="contactName"
                    type="text"
                    required
                    disabled={saving}
                    value={formData.contactName}
                    onChange={handleChange}
                    placeholder="e.g. S. Mukherjee"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="bank-contact-phone">Contact Phone *</label>
                  <input
                    id="bank-contact-phone"
                    name="contactPhone"
                    type="tel"
                    required
                    disabled={saving}
                    value={formData.contactPhone}
                    onChange={handleChange}
                    placeholder="e.g. +91 91234 56789"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Physical Address & Coordinates */}
            <div>
              <h4 style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={16} /> Location Coordinates
              </h4>
              <div className="form-grid">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="bank-address">Street Address *</label>
                  <input
                    id="bank-address"
                    name="address"
                    type="text"
                    required
                    disabled={saving}
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="e.g. 50 Red Cross Road, Near Civil Hospital"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="bank-city">City *</label>
                  <input
                    id="bank-city"
                    name="city"
                    type="text"
                    required
                    disabled={saving}
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="e.g. Mumbai"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="bank-locality">Locality</label>
                  <input
                    id="bank-locality"
                    name="locality"
                    type="text"
                    disabled={saving}
                    value={formData.locality}
                    onChange={handleChange}
                    placeholder="e.g. Dadar"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="bank-pincode">PIN Code</label>
                  <input
                    id="bank-pincode"
                    name="pinCode"
                    type="text"
                    disabled={saving}
                    value={formData.pinCode}
                    onChange={handleChange}
                    placeholder="e.g. 400014"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="bank-lat">Latitude</label>
                  <input
                    id="bank-lat"
                    name="latitude"
                    type="number"
                    step="any"
                    disabled={saving}
                    value={formData.latitude}
                    onChange={handleChange}
                    placeholder="e.g. 19.0178"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="bank-lng">Longitude</label>
                  <input
                    id="bank-lng"
                    name="longitude"
                    type="number"
                    step="any"
                    disabled={saving}
                    value={formData.longitude}
                    onChange={handleChange}
                    placeholder="e.g. 72.8478"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              icon={<Save size={16} />}
            >
              {profile ? 'Save profile' : 'Create profile'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
