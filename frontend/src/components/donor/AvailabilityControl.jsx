import React, { useState } from 'react';
import { formatDateTime } from '../../utils/dates.js';

export function AvailabilityControl({ profile, onChange }) {
  const [selectedStatus, setSelectedStatus] = useState(profile?.availability || 'AVAILABLE');
  const [saving, setSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(profile?.availabilityUpdatedAt);
  const [effectiveStatus, setEffectiveStatus] = useState(profile?.effectiveAvailability);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await onChange(selectedStatus);
      if (updated) {
        setLastUpdated(updated.availabilityUpdatedAt);
        setEffectiveStatus(updated.effectiveAvailability);
        setSuccess('Contact availability confirmed.');
      }
    } catch (err) {
      setError(err && err.message ? err.message : 'Failed to update availability.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card">
      <h3>Contact Availability</h3>
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
        Availability controls whether the matching service may send you emergency notifications. Medical suitability and final eligibility are determined solely by healthcare professionals at the donation facility.
      </p>

      {error && <div className="form-error">{error}</div>}
      {success && <div className="form-success">{success}</div>}

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', margin: '1.25rem 0', flexWrap: 'wrap' }}>
        <select
          value={selectedStatus}
          disabled={saving}
          onChange={(e) => setSelectedStatus(e.target.value)}
          style={{ padding: '0.5rem 0.85rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-strong)', fontSize: '0.95rem' }}
        >
          <option value="AVAILABLE">Available for emergency contact</option>
          <option value="UNAVAILABLE">Unavailable</option>
          <option value="UNKNOWN">Unknown / Unconfirmed</option>
        </select>

        <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSave}>
          {saving ? 'Confirming…' : 'Confirm Availability'}
        </button>
      </div>

      <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
        {lastUpdated ? (
          <p>Last confirmed: {formatDateTime(lastUpdated)}</p>
        ) : (
          <p>Availability has not been confirmed yet.</p>
        )}
        {effectiveStatus === 'UNKNOWN' && selectedStatus === 'AVAILABLE' && (
          <p style={{ color: 'var(--warning)', fontWeight: 500 }}>
            Confirmation window expired: your status is treated as UNKNOWN until re-confirmed.
          </p>
        )}
      </div>
    </section>
  );
}
