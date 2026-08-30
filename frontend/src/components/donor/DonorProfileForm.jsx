import React, { useState } from 'react';
import { BLOOD_GROUPS } from '../../utils/blood-groups.js';

export function DonorProfileForm({ profile, onSubmit }) {
  const [formData, setFormData] = useState({
    displayName: profile?.displayName || '',
    bloodGroup: profile?.bloodGroup || BLOOD_GROUPS[0],
    phone: profile?.phone || '',
    email: profile?.email || '',
    city: profile?.city || '',
    locality: profile?.locality || '',
    pinCode: profile?.pinCode || '',
    approxLatitude: profile?.approxLatitude ?? '',
    approxLongitude: profile?.approxLongitude ?? '',
    lastDonationDate: profile?.lastDonationDate || '',
    nextContactAfter: profile?.nextContactAfter
      ? new Date(profile.nextContactAfter).toISOString().slice(0, 16)
      : '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

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
      displayName: formData.displayName.trim(),
      bloodGroup: formData.bloodGroup,
      phone: formData.phone.trim() || null,
      email: formData.email.trim() || null,
      city: formData.city.trim(),
      locality: formData.locality.trim() || null,
      pinCode: formData.pinCode.trim() || null,
      approxLatitude: formData.approxLatitude !== '' ? Number(formData.approxLatitude) : null,
      approxLongitude: formData.approxLongitude !== '' ? Number(formData.approxLongitude) : null,
      lastDonationDate: formData.lastDonationDate || null,
      nextContactAfter: formData.nextContactAfter
        ? new Date(formData.nextContactAfter).toISOString()
        : null,
    };

    try {
      await onSubmit(payload);
      setSuccess('Donor profile saved successfully.');
    } catch (err) {
      setError(err && err.message ? err.message : 'Failed to save donor profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <div className="form-error">{error}</div>}
      {success && <div className="form-success">{success}</div>}

      <div className="form-grid">
        <div className="form-group">
          <label htmlFor="donor-name">Display Name *</label>
          <input
            id="donor-name"
            name="displayName"
            type="text"
            required
            disabled={saving}
            value={formData.displayName}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="donor-blood-group">Registered Blood Group *</label>
          <select
            id="donor-blood-group"
            name="bloodGroup"
            required
            disabled={saving}
            value={formData.bloodGroup}
            onChange={handleChange}
          >
            {BLOOD_GROUPS.map((bg) => (
              <option key={bg} value={bg}>
                {bg}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="donor-phone">Private Phone</label>
          <input
            id="donor-phone"
            name="phone"
            type="tel"
            disabled={saving}
            value={formData.phone}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="donor-email">Private Email</label>
          <input
            id="donor-email"
            name="email"
            type="email"
            disabled={saving}
            value={formData.email}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="donor-city">City *</label>
          <input
            id="donor-city"
            name="city"
            type="text"
            required
            disabled={saving}
            value={formData.city}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="donor-locality">Locality</label>
          <input
            id="donor-locality"
            name="locality"
            type="text"
            disabled={saving}
            value={formData.locality}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="donor-pincode">PIN Code</label>
          <input
            id="donor-pincode"
            name="pinCode"
            type="text"
            disabled={saving}
            value={formData.pinCode}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="donor-lat">Approximate Latitude</label>
          <input
            id="donor-lat"
            name="approxLatitude"
            type="number"
            step="any"
            disabled={saving}
            value={formData.approxLatitude}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="donor-lng">Approximate Longitude</label>
          <input
            id="donor-lng"
            name="approxLongitude"
            type="number"
            step="any"
            disabled={saving}
            value={formData.approxLongitude}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="donor-last-donation">Last Donation Date (self-reported)</label>
          <input
            id="donor-last-donation"
            name="lastDonationDate"
            type="date"
            disabled={saving}
            value={formData.lastDonationDate}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="donor-next-contact">Do Not Contact Before (suppression window)</label>
          <input
            id="donor-next-contact"
            name="nextContactAfter"
            type="datetime-local"
            disabled={saving}
            value={formData.nextContactAfter}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : profile ? 'Save Profile' : 'Create Profile'}
        </button>
      </div>
    </form>
  );
}
