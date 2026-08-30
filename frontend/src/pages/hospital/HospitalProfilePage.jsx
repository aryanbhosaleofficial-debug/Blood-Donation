import React, { useState, useEffect } from 'react';
import { hospitalApi } from '../../api/hospital.api.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';

export function HospitalProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

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
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading hospital profile…" />;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Hospital Profile</h2>
        {profile && (
          <div>
            <StatusBadge status={profile.isVerified ? 'verified' : 'pending'} />
            <span style={{ marginLeft: '0.5rem', fontSize: '0.9rem', color: 'var(--muted)' }}>
              {profile.isVerified ? 'Verified' : 'Pending Verification'}
            </span>
          </div>
        )}
      </div>

      <ErrorAlert error={error} onRetry={loadProfile} />
      {success && <div className="form-success">{success}</div>}

      <div className="card">
        <h3>{profile ? 'Edit Hospital Profile' : 'Create Hospital Profile'}</h3>
        <form onSubmit={handleSubmit}>
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
              />
            </div>

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
              />
            </div>

            <div className="form-group">
              <label htmlFor="hospital-address">Address *</label>
              <input
                id="hospital-address"
                name="address"
                type="text"
                required
                disabled={saving}
                value={formData.address}
                onChange={handleChange}
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
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : profile ? 'Save profile' : 'Create profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
