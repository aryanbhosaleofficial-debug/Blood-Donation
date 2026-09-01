import React, { useState, useEffect, useCallback } from 'react';
import { auditApi } from '../../api/audit.api.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { InfoBanner } from '../../components/common/InfoBanner.jsx';
import { Button } from '../../components/common/Button.jsx';
import { AuditLogTable } from '../../components/admin/AuditLogTable.jsx';
import { AuditFilterForm } from '../../components/admin/AuditFilterForm.jsx';
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

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
      <PageHeader
        title="System Audit Logs"
        description="Immutable, append-only chronological log of all security, inventory, and lifecycle coordination events."
        actions={
          <Button variant="secondary" onClick={load} icon={<RefreshCw size={14} />}>
            Refresh
          </Button>
        }
      />

      <InfoBanner variant="info">
        <strong>Append-Only Integrity:</strong> System events are immutable and cannot be edited or purged. Passwords, donor private contacts, and raw GPS coordinates are strictly scrubbed before persistence.
      </InfoBanner>

      <AuditFilterForm onApply={applyFilters} disabled={loading} />

      <ErrorAlert error={error} onRetry={load} />

      {loading ? (
        <LoadingSpinner message="Loading audit events…" />
      ) : (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <AuditLogTable rows={rows} />
          <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-4)', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
              {pagination.total === 0
                ? 'No events matching filters'
                : `Showing ${offset + 1}–${offset + rows.length} of ${pagination.total} events`}
            </span>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button
                variant="secondary"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(offset - PAGE_SIZE, 0))}
                icon={<ChevronLeft size={14} />}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!pagination.hasMore}
                onClick={() => setOffset(offset + PAGE_SIZE)}
                icon={<ChevronRight size={14} />}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
