import React from 'react';
import { formatDateTime } from '../../utils/dates.js';
import { StatusBadge } from '../common/StatusBadge.jsx';

export function HospitalAllocationList({ allocations = [] }) {
  return (
    <section className="card">
      <h3>Allocated by Blood Banks</h3>
      {allocations.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No blood-bank allocations reserved yet.</p>
      ) : (
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Blood Bank</th>
                <th>Units Reserved</th>
                <th>Status</th>
                <th>Reserved At</th>
                <th>Released At</th>
                <th>Completed At</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.bank?.name || 'Blood Bank'}</strong>
                  </td>
                  <td>{a.unitsReserved}</td>
                  <td>
                    <StatusBadge status={a.status} />
                  </td>
                  <td>{formatDateTime(a.reservedAt)}</td>
                  <td>{a.releasedAt ? formatDateTime(a.releasedAt) : '—'}</td>
                  <td>{a.completedAt ? formatDateTime(a.completedAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
