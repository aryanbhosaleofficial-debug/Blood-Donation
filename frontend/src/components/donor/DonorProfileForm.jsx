import React, { useState } from 'react';
import { BLOOD_GROUPS } from '../../utils/blood-groups.js';
import { Button } from '../common/Button.jsx';
import { BloodGroupBadge } from '../common/BloodGroupBadge.jsx';
import { User, Mail, MapPin, Calendar, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '../common/ToastContext.jsx';

export function DonorProfileForm({ profile, onSubmit }) {
  const toast = useToast();
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
      toast.success('Donor profile saved successfully.');
    } catch (err) {
      const msg = err && err.message ? err.message : 'Failed to save donor profile.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && (
        <div className="form-error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="form-success" role="status" style={{ marginBottom: 'var(--space-4)' }}>
          <CheckCircle2 size={16} />
          <span>{success}</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {/* Section 1: Basic Identity & Blood Group */}
        <div>
          <h4 style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <User size={16} /> Identity &amp; Blood Type
          </h4>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="donor-name">Display Name / Pseudonym *</label>
              <input
                id="donor-name"
                name="displayName"
                type="text"
                required
                disabled={saving}
                value={formData.displayName}
                onChange={handleChange}
                placeholder="e.g. Aryan B."
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
          </div>
        </div>

        {/* Section 2: Private Contact Info */}
        <div>
          <h4 style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Mail size={16} /> Private Contact Details (Never Shared with Hospitals)
          </h4>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="donor-phone">Private Phone Number</label>
              <input
                id="donor-phone"
                name="phone"
                type="tel"
                disabled={saving}
                value={formData.phone}
                onChange={handleChange}
                placeholder="e.g. +91 98765 43210"
              />
              <span className="form-hint">Used strictly for automated emergency SMS alerts.</span>
            </div>

            <div className="form-group">
              <label htmlFor="donor-email">Private Email Address</label>
              <input
                id="donor-email"
                name="email"
                type="email"
                disabled={saving}
                value={formData.email}
                onChange={handleChange}
                placeholder="e.g. donor@example.com"
              />
              <span className="form-hint">Used for urgent notification alerts.</span>
            </div>
          </div>
        </div>

        {/* Section 3: Geographic Locality */}
        <div>
          <h4 style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={16} /> Geographic Cluster &amp; Locality
          </h4>
          <div className="form-grid">
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
                placeholder="e.g. Mumbai"
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
                placeholder="e.g. Dadar"
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
                placeholder="e.g. 400014"
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
                placeholder="e.g. 19.0178"
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
                placeholder="e.g. 72.8478"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Self-Reported History */}
        <div>
          <h4 style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={16} /> Self-Reported History &amp; Suppression Window
          </h4>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="donor-last-donation">Last Donation Date</label>
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
              <label htmlFor="donor-next-contact">Do Not Contact Before (Temporary Pause)</label>
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
        </div>
      </div>

      <div className="form-actions">
        <Button
          type="submit"
          variant="primary"
          loading={saving}
          icon={<Save size={16} />}
        >
          {profile ? 'Save Profile' : 'Create Profile'}
        </Button>
      </div>
    </form>
  );
}
