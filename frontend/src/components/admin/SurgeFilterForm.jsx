import React, { useState } from 'react';
import { Button } from '../common/Button.jsx';
import { Filter, RotateCcw } from 'lucide-react';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const STATUSES = ['PENDING', 'CONFIRMED', 'REJECTED', 'STALE'];

const EMPTY = { status: '', city: '', bloodGroup: '', isSynthetic: '' };

export function SurgeFilterForm({ onApply, disabled }) {
  const [values, setValues] = useState(EMPTY);
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    onApply({ ...values });
  };
  const reset = () => { setValues(EMPTY); onApply({}); };

  return (
    <form className="card" onSubmit={submit} style={{ padding: 'var(--space-5)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-4)', alignItems: 'flex-end' }}>
        <div className="form-group">
          <label htmlFor="surge-filter-status">Status</label>
          <select id="surge-filter-status" value={values.status} onChange={set('status')} disabled={disabled}>
            <option value="">Any Status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="surge-filter-city">City</label>
          <input id="surge-filter-city" type="text" placeholder="e.g. Ahmedabad" value={values.city} onChange={set('city')} disabled={disabled} />
        </div>

        <div className="form-group">
          <label htmlFor="surge-filter-bg">Blood group</label>
          <select id="surge-filter-bg" value={values.bloodGroup} onChange={set('bloodGroup')} disabled={disabled}>
            <option value="">Any Blood Group</option>
            {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="surge-filter-data">Data Stream</label>
          <select id="surge-filter-data" value={values.isSynthetic} onChange={set('isSynthetic')} disabled={disabled}>
            <option value="">Any Stream</option>
            <option value="false">Real Operational Only</option>
            <option value="true">Demo / Synthetic Only</option>
          </select>
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
