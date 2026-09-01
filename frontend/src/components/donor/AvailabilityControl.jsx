import React, { useState } from 'react';
import { formatDateTime } from '../../utils/dates.js';
import { Button } from '../common/Button.jsx';
import { StatusBadge } from '../common/StatusBadge.jsx';
import { CheckCircle2, AlertCircle, Clock, Activity } from 'lucide-react';
import { useToast } from '../common/ToastContext.jsx';

export function AvailabilityControl({ profile, onChange }) {
  const toast = useToast();
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
        const msg = 'Contact availability confirmed.';
        setSuccess(msg);
        toast.success(msg);
      }
    } catch (err) {
      const msg = err && err.message ? err.message : 'Failed to update availability.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card">
      <div className="card-header">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Activity size={18} style={{ color: 'var(--color-primary-800)' }} />
          Emergency Contact Availability
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Effective Status:</span>
          <StatusBadge status={effectiveStatus || selectedStatus} />
        </div>
      </div>

      <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.6 }}>
        Availability controls whether the matching service may send you emergency notifications when urgent red-cell requests match your blood group. Final suitability and eligibility are determined solely by healthcare professionals at the donation facility.
      </p>

      {error && (
        <div className="form-error" role="alert" style={{ margin: 'var(--space-4) 0' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="form-success" role="status" style={{ margin: 'var(--space-4) 0' }}>
          <CheckCircle2 size={16} />
          <span>{success}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', margin: 'var(--space-5) 0', flexWrap: 'wrap' }}>
        <select
          value={selectedStatus}
          disabled={saving}
          onChange={(e) => setSelectedStatus(e.target.value)}
          style={{ minHeight: 40, padding: '0.4rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-strong)', fontSize: 'var(--font-size-base)', fontWeight: 500 }}
        >
          <option value="AVAILABLE">Available for emergency contact</option>
          <option value="UNAVAILABLE">Unavailable / Do Not Contact</option>
          <option value="UNKNOWN">Unknown / Unconfirmed</option>
        </select>

        <Button
          variant="primary"
          disabled={saving}
          loading={saving}
          onClick={handleSave}
        >
          Confirm Availability
        </Button>
      </div>

      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)' }}>
        {lastUpdated ? (
          <p style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} /> Last confirmed: {formatDateTime(lastUpdated)}
          </p>
        ) : (
          <p>Availability has not been confirmed yet.</p>
        )}
        {effectiveStatus === 'UNKNOWN' && selectedStatus === 'AVAILABLE' && (
          <p style={{ color: 'var(--color-warning)', fontWeight: 600, marginTop: 4 }}>
            Confirmation window expired: status is treated as UNKNOWN until re-confirmed.
          </p>
        )}
      </div>
    </section>
  );
}
