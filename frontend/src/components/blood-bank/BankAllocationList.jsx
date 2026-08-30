import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../common/StatusBadge.jsx';
import { formatDateTime } from '../../utils/dates.js';

export function BankAllocationList({ allocations = [], onRelease, onComplete }) {
  const [busyId, setBusyId] = useState(null);

  const handleAction = async (id, actionFn) => {
    setBusyId(id);
    try {
      await actionFn(id);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="table-responsive">
      <table>
        <thead>
          <tr>
            <th>Request</th>
            <th>Blood Group</th>
            <th>Units Reserved</th>
            <th>Status</th>
            <th>Reserved At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {allocations.length === 0 ? (
            <tr>
              <td colSpan="6" style={{ textAlign: 'center', color: 'var(--muted)' }}>
                No allocations recorded yet.
              </td>
            </tr>
          ) : (
            allocations.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link to={`/blood-bank/requests/${a.request?.id || a.requestId}`}>
                    <strong>#{a.request?.id || a.requestId}</strong>
                  </Link>
                </td>
                <td>{a.request?.bloodGroup || '—'}</td>
                <td>
                  <strong>{a.unitsReserved}</strong>
                </td>
                <td>
                  <StatusBadge status={a.status} />
                </td>
                <td>{formatDateTime(a.reservedAt)}</td>
                <td>
                  {a.status === 'RESERVED' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                        disabled={busyId === a.id}
                        onClick={() => handleAction(a.id, onRelease)}
                      >
                        Release
                      </button>
                      <button
                        type="button"
                        className="btn btn-success"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                        disabled={busyId === a.id}
                        onClick={() => handleAction(a.id, onComplete)}
                      >
                        Complete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
