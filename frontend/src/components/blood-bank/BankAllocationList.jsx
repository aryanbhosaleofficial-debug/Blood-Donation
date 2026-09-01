import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../common/StatusBadge.jsx';
import { BloodGroupBadge } from '../common/BloodGroupBadge.jsx';
import { Button } from '../common/Button.jsx';
import { formatDateTime } from '../../utils/dates.js';
import { Check, RotateCcw, ExternalLink } from 'lucide-react';

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
            <th>Request ID</th>
            <th>Blood Group</th>
            <th>Units Reserved</th>
            <th>Status</th>
            <th>Reserved At</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {allocations.length === 0 ? (
            <tr>
              <td colSpan="6" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-8)' }}>
                No active or historical allocations recorded for your organization.
              </td>
            </tr>
          ) : (
            allocations.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link
                    to={`/blood-bank/requests/${a.request?.id || a.requestId}`}
                    style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    #{a.request?.id || a.requestId} <ExternalLink size={12} />
                  </Link>
                </td>
                <td>
                  {a.request?.bloodGroup ? (
                    <BloodGroupBadge bloodGroup={a.request.bloodGroup} />
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  <strong style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)' }}>
                    {a.unitsReserved}
                  </strong>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginLeft: 4 }}>
                    {a.unitsReserved === 1 ? 'unit' : 'units'}
                  </span>
                </td>
                <td>
                  <StatusBadge status={a.status} />
                </td>
                <td>
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    {formatDateTime(a.reservedAt)}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  {a.status === 'RESERVED' && (
                    <div style={{ display: 'inline-flex', gap: 'var(--space-2)' }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busyId === a.id}
                        onClick={() => handleAction(a.id, onRelease)}
                        icon={<RotateCcw size={12} />}
                      >
                        Release
                      </Button>
                      <Button
                        variant="success"
                        size="sm"
                        disabled={busyId === a.id}
                        onClick={() => handleAction(a.id, onComplete)}
                        icon={<Check size={12} />}
                      >
                        Complete
                      </Button>
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
