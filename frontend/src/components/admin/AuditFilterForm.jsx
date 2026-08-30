import React, { useState } from 'react';

// Mirrors backend audit.constants (kept explicit to avoid a shared bundle).
export const AUDIT_ACTIONS = [
  'AUTH_LOGIN_SUCCEEDED', 'AUTH_LOGIN_FAILED', 'AUTH_ACCOUNT_LOCKED', 'AUTH_LOGOUT',
  'ORGANIZATION_PROFILE_CREATED', 'ORGANIZATION_PROFILE_UPDATED', 'ORGANIZATION_VERIFIED',
  'ORGANIZATION_VERIFICATION_REVOKED', 'INVENTORY_UPDATED',
  'REQUEST_CREATED', 'REQUEST_CANCELLED', 'REQUEST_COMPLETED', 'REQUEST_EXPIRED',
  'ALLOCATION_RESERVED', 'ALLOCATION_RELEASED', 'ALLOCATION_COMPLETED',
  'DONOR_PROFILE_CREATED', 'DONOR_PROFILE_UPDATED', 'DONOR_AVAILABILITY_CHANGED',
  'DONOR_FALLBACK_ACTIVATED', 'DONOR_ALERT_CREATED',
  'DONOR_PLEDGE_CREATED', 'DONOR_PLEDGE_CANCELLED', 'DONOR_PLEDGE_ARRIVED',
  'DONOR_PLEDGE_DEFERRED', 'DONOR_PLEDGE_EXPIRED',
  'LOCATION_SHARING_STARTED', 'LOCATION_SHARING_STOPPED', 'LOCATION_SESSION_EXPIRED',
  'NOTIFICATION_QUEUED', 'NOTIFICATION_SENT', 'NOTIFICATION_FAILED',
];

export const AUDIT_ENTITIES = [
  'USER', 'HOSPITAL', 'BLOOD_BANK', 'INVENTORY', 'REQUEST', 'ALLOCATION',
  'DONOR', 'DONOR_ALERT', 'PLEDGE', 'LOCATION_SESSION', 'NOTIFICATION',
];

const EMPTY = { action: '', entityType: '', entityId: '', actorUserId: '', from: '', to: '' };

export function AuditFilterForm({ onApply, disabled }) {
  const [values, setValues] = useState(EMPTY);

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    onApply({ ...values });
  };

  const reset = () => {
    setValues(EMPTY);
    onApply({});
  };

  return (
    <form className="card audit-filter-form" onSubmit={submit} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
      <label>
        Action
        <select value={values.action} onChange={set('action')} disabled={disabled}>
          <option value="">Any</option>
          {AUDIT_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </label>
      <label>
        Entity type
        <select value={values.entityType} onChange={set('entityType')} disabled={disabled}>
          <option value="">Any</option>
          {AUDIT_ENTITIES.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </label>
      <label>
        Entity ID
        <input type="number" min="1" value={values.entityId} onChange={set('entityId')} disabled={disabled} />
      </label>
      <label>
        Actor user ID
        <input type="number" min="1" value={values.actorUserId} onChange={set('actorUserId')} disabled={disabled} />
      </label>
      <label>
        From (UTC)
        <input type="datetime-local" value={values.from} onChange={set('from')} disabled={disabled} />
      </label>
      <label>
        To (UTC)
        <input type="datetime-local" value={values.to} onChange={set('to')} disabled={disabled} />
      </label>
      <button type="submit" className="btn btn-primary" disabled={disabled}>Apply</button>
      <button type="button" className="btn btn-secondary" onClick={reset} disabled={disabled}>Reset</button>
    </form>
  );
}
