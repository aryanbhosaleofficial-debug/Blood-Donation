import React, { useState, useEffect } from 'react';
import { hospitalApi } from '../../api/hospital.api.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { Button } from '../../components/common/Button.jsx';
import { InfoBanner } from '../../components/common/InfoBanner.jsx';
import { Building2, Save, MapPin, Phone, User, CheckCircle2 } from 'lucide-react';
import { useToast } from '../../components/common/ToastContext.jsx';

export function HospitalProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const toast = useToast();

  const [formData, setFormData] = useState({
    name: '',
    registrationReference: '',
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
      const data = await hospitalApi.getProfile();
      if (data) {
        setProfile(data);
        setFormData({
          name: data.name || '',
          registrationReference: data.registrationReference || '',
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
      payload.registrationReference = formData.registrationReference.trim();
    }

    try {
      let saved;
      if (profile) {
        saved = await hospitalApi.updateProfile(payload);
      } else {
        saved = await hospitalApi.createProfile(payload);
      }
      setProfile(saved);
      setSuccess('Hospital profile saved successfully.');
      toast.success('Hospital profile saved successfully.');
    } catch (err) {
      setError(err);
      toast.error('Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading hospital profile…" />;
  }

  return (
    <div className="page-container">
      <PageHeader
        title="Hospital Profile"
        description="Maintain official hospital contact details, geographic coordinates, and license registration for network verification."
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
          <strong>Verified Hospital:</strong> Registration reference is locked while verified. Contact system admin for legal entity modifications.
        </InfoBanner>
      ) : (
        <InfoBanner variant="warning">
          <strong>Verification Notice:</strong> Accurate license registration references are required before posting emergency red-cell broadcast requests.
        </InfoBanner>
      )}

      <div className="card">
        <div className="card-header">
          <h3>{profile ? 'Edit Hospital Profile' : 'Create Hospital Profile'}</h3>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {/* Section 1: Facility Details */}
            <div>
              <h4 style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Building2 size={16} /> Organization Details
              </h4>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="hospital-name">Hospital Name *</label>
                  <input
                    id="hospital-name"
                    name="name"
                    type="text"
                    required
                    disabled={saving}
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g. City General Hospital"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="hospital-reg">Registration Reference *</label>
                  <input
                    id="hospital-reg"
                    name="registrationReference"
                    type="text"
                    required
                    disabled={saving || Boolean(profile?.isVerified)}
                    value={formData.registrationReference}
                    onChange={handleChange}
                    placeholder="e.g. REG-HOSP-2026-001"
                  />
                  {profile?.isVerified && (
                    <span className="form-hint">Locked for verified organizations.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Section 2: Contact Person */}
            <div>
              <h4 style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <User size={16} /> Primary Contact
              </h4>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="hospital-contact-name">Contact Person Name *</label>
                  <input
                    id="hospital-contact-name"
                    name="contactName"
                    type="text"
                    required
                    disabled={saving}
                    value={formData.contactName}
                    onChange={handleChange}
                    placeholder="e.g. Dr. Rajesh Sharma"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="hospital-contact-phone">Contact Phone *</label>
                  <input
                    id="hospital-contact-phone"
                    name="contactPhone"
                    type="tel"
                    required
                    disabled={saving}
                    value={formData.contactPhone}
                    onChange={handleChange}
                    placeholder="e.g. +91 98765 43210"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Physical Address & Location */}
            <div>
              <h4 style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={16} /> Physical Address & Coordinates
              </h4>
              <div className="form-grid">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="hospital-address">Street Address *</label>
                  <input
                    id="hospital-address"
                    name="address"
                    type="text"
                    required
                    disabled={saving}
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="e.g. 104 Central Avenue, Medical District"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="hospital-city">City *</label>
                  <input
                    id="hospital-city"
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
                  <label htmlFor="hospital-locality">Locality</label>
                  <input
                    id="hospital-locality"
                    name="locality"
                    type="text"
                    disabled={saving}
                    value={formData.locality}
                    onChange={handleChange}
                    placeholder="e.g. Dadar"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="hospital-pincode">PIN Code</label>
                  <input
                    id="hospital-pincode"
                    name="pinCode"
                    type="text"
                    disabled={saving}
                    value={formData.pinCode}
                    onChange={handleChange}
                    placeholder="e.g. 400014"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="hospital-lat">Latitude</label>
                  <input
                    id="hospital-lat"
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
                  <label htmlFor="hospital-lng">Longitude</label>
                  <input
                    id="hospital-lng"
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
