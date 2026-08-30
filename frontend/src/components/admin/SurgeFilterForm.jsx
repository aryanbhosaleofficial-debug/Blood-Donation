import React, { useState } from 'react';

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
    <form className="card" onSubmit={submit} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
      <label>
        Status
        <select value={values.status} onChange={set('status')} disabled={disabled}>
          <option value="">Any</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <label>
        City
        <input type="text" value={values.city} onChange={set('city')} disabled={disabled} />
      </label>
      <label>
        Blood group
        <select value={values.bloodGroup} onChange={set('bloodGroup')} disabled={disabled}>
          <option value="">Any</option>
          {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </label>
      <label>
        Data
        <select value={values.isSynthetic} onChange={set('isSynthetic')} disabled={disabled}>
          <option value="">Any</option>
          <option value="false">Real only</option>
          <option value="true">Demo / synthetic only</option>
        </select>
      </label>
      <button type="submit" className="btn btn-primary" disabled={disabled}>Apply</button>
      <button type="button" className="btn btn-secondary" onClick={reset} disabled={disabled}>Reset</button>
    </form>
  );
}
