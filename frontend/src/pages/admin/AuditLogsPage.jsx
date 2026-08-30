import React, { useState, useEffect, useCallback } from 'react';
import { auditApi } from '../../api/audit.api.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { AuditLogTable } from '../../components/admin/AuditLogTable.jsx';
import { AuditFilterForm } from '../../components/admin/AuditFilterForm.jsx';

const PAGE_SIZE = 50;

/** datetime-local -> ISO 8601 with offset (backend requires a full timestamp). */
function toIso(value) {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * Admin audit-log viewer (Module 08). Read-only; audit rows are append-only.
 */
export function AuditLogsPage() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, limit: PAGE_SIZE, offset: 0, hasMore: false });
  const [filters, setFilters] = useState({});
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = {
        ...filters,
        from: toIso(filters.from),
        to: toIso(filters.to),
        limit: PAGE_SIZE,
        offset,
      };
      const res = await auditApi.getAuditLogs(query);
      setRows(res.auditLogs || []);
      setPagination(res.pagination || { total: 0, limit: PAGE_SIZE, offset, hasMore: false });
    } catch (err) {
      setError(err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filters, offset]);

  useEffect(() => { load(); }, [load]);

  const applyFilters = (next) => {
    setOffset(0);
    setFilters(next);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Audit Logs</h2>
        <button type="button" className="btn btn-secondary" onClick={load}>Refresh</button>
      </div>

      <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
        Append-only record of accountable domain events. Secrets, donor contact details, and exact
        coordinates are never stored here.
      </p>

      <AuditFilterForm onApply={applyFilters} disabled={loading} />

      <ErrorAlert error={error} onRetry={load} />

      {loading ? (
        <LoadingSpinner message="Loading audit events…" />
      ) : (
        <>
          <AuditLogTable rows={rows} />
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '1rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(offset - PAGE_SIZE, 0))}
            >
              Previous
            </button>
            <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
              {pagination.total === 0
                ? 'No events'
                : `Showing ${offset + 1}–${offset + rows.length} of ${pagination.total}`}
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!pagination.hasMore}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
