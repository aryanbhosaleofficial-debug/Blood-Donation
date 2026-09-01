import React, { useState } from 'react';
import { Button } from '../common/Button.jsx';
import { Filter, RotateCcw } from 'lucide-react';

// Mirrors backend audit.constants
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
    <form className="card audit-filter-form" onSubmit={submit} style={{ padding: 'var(--space-5)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)', alignItems: 'flex-end' }}>
        <div className="form-group">
          <label htmlFor="audit-filter-action">Action</label>
          <select id="audit-filter-action" value={values.action} onChange={set('action')} disabled={disabled}>
            <option value="">Any Action</option>
            {AUDIT_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="audit-filter-entity">Entity type</label>
          <select id="audit-filter-entity" value={values.entityType} onChange={set('entityType')} disabled={disabled}>
            <option value="">Any Entity</option>
            {AUDIT_ENTITIES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="audit-filter-entity-id">Entity ID</label>
          <input id="audit-filter-entity-id" type="number" min="1" placeholder="e.g. 42" value={values.entityId} onChange={set('entityId')} disabled={disabled} />
        </div>

        <div className="form-group">
          <label htmlFor="audit-filter-actor">Actor user ID</label>
          <input id="audit-filter-actor" type="number" min="1" placeholder="e.g. 10" value={values.actorUserId} onChange={set('actorUserId')} disabled={disabled} />
        </div>

        <div className="form-group">
          <label htmlFor="audit-filter-from">From (UTC)</label>
          <input id="audit-filter-from" type="datetime-local" value={values.from} onChange={set('from')} disabled={disabled} />
        </div>

        <div className="form-group">
          <label htmlFor="audit-filter-to">To (UTC)</label>
          <input id="audit-filter-to" type="datetime-local" value={values.to} onChange={set('to')} disabled={disabled} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)', justifyContent: 'flex-end' }}>
        <Button variant="secondary" size="sm" onClick={reset} disabled={disabled} icon={<RotateCcw size={13} />}>
          Reset
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={disabled} icon={<Filter size={13} />}>
          Apply
        </Button>
      </div>
    </form>
  );
}
