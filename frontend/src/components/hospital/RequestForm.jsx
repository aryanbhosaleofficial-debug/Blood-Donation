import React, { useState, useRef } from 'react';
import { BLOOD_GROUPS, URGENCIES, DEFAULT_COMPONENT } from '../../utils/blood-groups.js';

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
    <form onSubmit={handleSubmit} className="form-grid" noValidate>
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
        <label htmlFor="req-urgency">Urgency *</label>
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
      </div>

      <div className="form-group">
        <label htmlFor="req-units">Units Needed (Red Cells) *</label>
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
      </div>

      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
        <label htmlFor="req-note">Clinical / Location Note (optional, max 500 chars)</label>
        <textarea
          id="req-note"
          name="note"
          maxLength={500}
          disabled={disabled || submitting}
          placeholder="Add logistical details, ward info, or delivery contact instructions..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {error && (
        <div className="form-error" style={{ gridColumn: '1 / -1' }} role="alert">
          {error}
        </div>
      )}

      <div className="form-actions" style={{ gridColumn: '1 / -1' }}>
        <button type="submit" className="btn btn-primary" disabled={disabled || submitting}>
          {submitting ? 'Posting Request…' : 'Post Emergency Request'}
        </button>
      </div>
    </form>
  );
}
