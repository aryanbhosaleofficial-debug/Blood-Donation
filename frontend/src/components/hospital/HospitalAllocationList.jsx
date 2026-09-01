import React from 'react';
import { formatDateTime } from '../../utils/dates.js';
import { StatusBadge } from '../common/StatusBadge.jsx';
import { Building2, PackageCheck } from 'lucide-react';

export function HospitalAllocationList({ allocations = [] }) {
  return (
    <section className="card">
      <div className="card-header">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <PackageCheck size={18} style={{ color: 'var(--color-primary-800)' }} />
          Allocations from Participating Blood Banks
        </h3>
        <span className="badge" style={{ backgroundColor: 'var(--color-primary-50)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
          {allocations.length} {allocations.length === 1 ? 'allocation' : 'allocations'}
        </span>
      </div>

      {allocations.length === 0 ? (
        <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-md)' }}>
          <p style={{ fontSize: 'var(--font-size-sm)' }}>No blood-bank allocations reserved yet. Open broadcast in progress.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Blood Bank Facility</th>
                <th>Units Reserved</th>
                <th>Status</th>
                <th>Reserved Time</th>
                <th>Released Time</th>
                <th>Completed Time</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <Building2 size={15} style={{ color: 'var(--color-text-muted)' }} />
                      <strong>{a.bank?.name || 'Blood Bank'}</strong>
                    </div>
                  </td>
                  <td>
                    <strong style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)' }}>
                      {a.unitsReserved} {a.unitsReserved === 1 ? 'unit' : 'units'}
                    </strong>
                  </td>
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
