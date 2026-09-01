import React, { useState, useRef } from 'react';
import { BLOOD_GROUPS, URGENCIES, DEFAULT_COMPONENT } from '../../utils/blood-groups.js';
import { BloodGroupBadge } from '../common/BloodGroupBadge.jsx';
import { UrgencyBadge } from '../common/UrgencyBadge.jsx';
import { Button } from '../common/Button.jsx';
import { Droplets, Send, AlertTriangle } from 'lucide-react';

export function RequestForm({ onSubmit, disabled = false }) {
  const [bloodGroup, setBloodGroup] = useState(BLOOD_GROUPS[0]);
  const [urgency, setUrgency] = useState(URGENCIES[0]);
  const [unitsNeeded, setUnitsNeeded] = useState(1);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Idempotency: single clientRequestId per logical attempt, preserved across retries
  const clientRequestIdRef = useRef(crypto.randomUUID());

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const payload = {
      clientRequestId: clientRequestIdRef.current,
      bloodGroup,
      component: DEFAULT_COMPONENT,
      unitsNeeded: Number(unitsNeeded),
      urgency,
    };

    const trimmedNote = note.trim();
    if (trimmedNote) {
      payload.note = trimmedNote;
    }

    try {
      await onSubmit(payload);
      // New logical submission attempt gets a new clientRequestId
      clientRequestIdRef.current = crypto.randomUUID();
      setNote('');
      setUnitsNeeded(1);
    } catch (err) {
      setError(err && err.message ? err.message : 'Could not post emergency request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {/* Section 1: Blood Requirement */}
        <div>
          <h4 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-3)', color: 'var(--color-text-primary)' }}>
            1. Blood Requirement
          </h4>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="req-blood-group">Blood Group *</label>
              <select
                id="req-blood-group"
                name="bloodGroup"
                disabled={disabled || submitting}
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
              >
                {BLOOD_GROUPS.map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="req-component">Component</label>
              <input
                id="req-component"
                type="text"
                name="component"
                readOnly
                disabled
                value={DEFAULT_COMPONENT}
              />
              <span className="form-hint">Standard emergency red-cell component</span>
            </div>

            <div className="form-group">
              <label htmlFor="req-units">Units Needed *</label>
              <input
                id="req-units"
                type="number"
                name="unitsNeeded"
                min="1"
                max="20"
                step="1"
                required
                disabled={disabled || submitting}
                value={unitsNeeded}
                onChange={(e) => setUnitsNeeded(e.target.value)}
              />
              <span className="form-hint">Quantity between 1 and 20 units</span>
            </div>
          </div>
        </div>

        {/* Section 2: Priority & Urgency */}
        <div>
          <h4 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-3)', color: 'var(--color-text-primary)' }}>
            2. Urgency &amp; Broadcast Window
          </h4>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="req-urgency">Urgency Level *</label>
              <select
                id="req-urgency"
                name="urgency"
                disabled={disabled || submitting}
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
              >
                {URGENCIES.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <span className="form-hint">
                {urgency === 'CRITICAL' && 'Immediate life-threatening need. Expedited matching.'}
                {urgency === 'URGENT' && 'High priority red-cell requirement within 2-4 hours.'}
                {urgency === 'NORMAL' && 'Standard scheduled operational coordination.'}
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Logistical Notes */}
        <div>
          <h4 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-3)', color: 'var(--color-text-primary)' }}>
            3. Logistical Details &amp; Contact Note (Optional)
          </h4>
          <div className="form-group">
            <label htmlFor="req-note">Ward / Delivery Instructions (max 500 chars)</label>
            <textarea
              id="req-note"
              name="note"
              maxLength={500}
              disabled={disabled || submitting}
              placeholder="e.g. ICU Wing 3rd Floor, Delivery via Emergency Gate 2, Dr. On Call extension 4022..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {/* Live Summary Preview Box */}
        <div
          style={{
            backgroundColor: 'var(--color-surface-subtle)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <BloodGroupBadge bloodGroup={bloodGroup} size="lg" />
            <div>
              <strong style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)' }}>
                {unitsNeeded} {Number(unitsNeeded) === 1 ? 'unit' : 'units'} of {DEFAULT_COMPONENT}
              </strong>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 2 }}>
                <UrgencyBadge urgency={urgency} />
              </div>
            </div>
          </div>

          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Broadcasts to verified blood banks in your geographic cluster.
          </div>
        </div>

        {error && (
          <div className="form-error" role="alert">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="form-actions" style={{ marginTop: 'var(--space-2)' }}>
          <Button
            type="submit"
            variant="emergency"
            size="lg"
            loading={submitting}
            disabled={disabled || submitting}
            icon={<Send size={16} />}
          >
            {submitting ? 'Posting Request…' : 'Post Emergency Request'}
          </Button>
        </div>
      </div>
    </form>
  );
}
