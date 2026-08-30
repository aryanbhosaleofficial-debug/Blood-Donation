import React, { useState, useEffect } from 'react';
import { bloodBankApi } from '../../api/blood-bank.api.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';

export function BloodBankProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

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
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading blood bank profile…" />;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Blood Bank Profile</h2>
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
        <h3>{profile ? 'Edit Blood Bank Profile' : 'Create Blood Bank Profile'}</h3>
        <form onSubmit={handleSubmit}>
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
              />
            </div>

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
              />
            </div>

            <div className="form-group">
              <label htmlFor="bank-address">Address *</label>
              <input
                id="bank-address"
                name="address"
                type="text"
                required
                disabled={saving}
                value={formData.address}
                onChange={handleChange}
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
