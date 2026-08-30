import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { OperationalMetricsPage } from '../src/pages/admin/OperationalMetricsPage.jsx';
import { AuditLogsPage } from '../src/pages/admin/AuditLogsPage.jsx';
import { RoleRoute } from '../src/router/RoleRoute.jsx';
import { AuthContext } from '../src/context/AuthContext.jsx';
import { metricsApi } from '../src/api/metrics.api.js';
import { auditApi } from '../src/api/audit.api.js';

const METRICS = {
  metrics: {
    requests: { total: 6, open: 2, covered: 1, completed: 1, cancelled: 1, expired: 1, synthetic: 2, nonSynthetic: 4, byUrgency: { normal: 1, urgent: 2, critical: 3 } },
    allocations: { total: 3, reserved: 1, released: 1, completed: 1, totalUnitsReserved: 7 },
    inventory: { totalRecordedRedCellUnits: 40, staleInventoryRows: 2, freshInventoryRows: 6 },
    donors: { totalDonorProfiles: 5, available: 3, unavailable: 1, unknown: 1, activeDonorAlerts: 2 },
    pledges: { active: 1, arrived: 1, cancelled: 0, expired: 2, deferred: 0, closed: 1 },
    notifications: { queued: 4, sent: 10, failed: 1, unread: 3 },
    cleanup: { pastDueActiveRequests: 1, expiredLocationSessionsRemaining: 0, lastRequestExpiryRunAt: null, lastLocationCleanupRunAt: null },
    workers: { notification: 'running', requestExpiry: 'running', locationCleanup: 'running' },
  },
};

describe('Admin — Operational Metrics page (AU)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('shows a loading state, then renders metric sections', async () => {
    vi.spyOn(metricsApi, 'getMetrics').mockResolvedValue(METRICS);
    render(<OperationalMetricsPage />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);

    await waitFor(() => expect(screen.getByText('Emergency Requests')).toBeInTheDocument());
    expect(screen.getByText('Recorded Bank Allocations')).toBeInTheDocument();
    expect(screen.getByText('Cleanup Workers')).toBeInTheDocument();
    // synthetic separation surfaced
    expect(screen.getByText('Synthetic')).toBeInTheDocument();
    expect(screen.getByText('Non-synthetic')).toBeInTheDocument();
  });

  it('renders an error state with retry on failure', async () => {
    vi.spyOn(metricsApi, 'getMetrics').mockRejectedValue(new Error('boom'));
    render(<OperationalMetricsPage />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('uses safe, non-medical wording', async () => {
    vi.spyOn(metricsApi, 'getMetrics').mockResolvedValue(METRICS);
    render(<OperationalMetricsPage />);
    await waitFor(() => expect(screen.getByText('Potential Donors')).toBeInTheDocument());
    expect(screen.queryByText(/safe donors|guaranteed units|successful transfusions/i)).toBeNull();
  });
});

describe('Admin — Audit Logs page (AV, AX)', () => {
  beforeEach(() => vi.restoreAllMocks());

  const page = (rows, total = rows.length) => ({
    auditLogs: rows,
    pagination: { total, limit: 50, offset: 0, hasMore: total > rows.length },
  });

  it('loads and lists audit rows', async () => {
    vi.spyOn(auditApi, 'getAuditLogs').mockResolvedValue(page([
      { id: 2, action: 'REQUEST_EXPIRED', entityType: 'REQUEST', entityId: 9, actorUserId: null, metadata: { previousStatus: 'OPEN' }, createdAt: '2026-08-31T10:00:00.000Z' },
      { id: 1, action: 'AUTH_LOGIN_SUCCEEDED', entityType: 'USER', entityId: 3, actorUserId: 3, metadata: { role: 'ADMIN' }, createdAt: '2026-08-31T09:00:00.000Z' },
    ]));
    render(<AuditLogsPage />);
    await waitFor(() => expect(screen.getByRole('cell', { name: 'REQUEST_EXPIRED' })).toBeInTheDocument());
    expect(screen.getByRole('cell', { name: 'AUTH_LOGIN_SUCCEEDED' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'system' })).toBeInTheDocument(); // null actor
  });

  it('shows an empty state', async () => {
    vi.spyOn(auditApi, 'getAuditLogs').mockResolvedValue(page([], 0));
    render(<AuditLogsPage />);
    await waitFor(() => expect(screen.getByText(/no audit events/i)).toBeInTheDocument());
  });

  it('shows an error state on failure', async () => {
    vi.spyOn(auditApi, 'getAuditLogs').mockRejectedValue(new Error('nope'));
    render(<AuditLogsPage />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('applies an action filter (re-queries with the selected action)', async () => {
    const spy = vi.spyOn(auditApi, 'getAuditLogs').mockResolvedValue(page([]));
    render(<AuditLogsPage />);
    await waitFor(() => expect(spy).toHaveBeenCalled());

    await userEvent.selectOptions(screen.getByLabelText('Action'), 'REQUEST_EXPIRED');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      const lastCall = spy.mock.calls.at(-1)[0];
      expect(lastCall.action).toBe('REQUEST_EXPIRED');
    });
  });

  it('AW: a non-admin user is redirected away from the admin route (backend stays authoritative)', async () => {
    const auth = {
      user: { id: 9, email: 'h@x.com', role: 'HOSPITAL' },
      isAuthenticated: true,
      loading: false,
      login: vi.fn(), logout: vi.fn(), refreshUser: vi.fn(),
    };
    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/admin/audit-logs']}>
          <Routes>
            <Route path="/admin/audit-logs" element={<RoleRoute allowedRoles={['ADMIN']}><AuditLogsPage /></RoleRoute>} />
            <Route path="/hospital" element={<div>hospital landing</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    await waitFor(() => expect(screen.getByText('hospital landing')).toBeInTheDocument());
    expect(screen.queryByText('Audit Logs')).toBeNull();
  });

  it('renders HTML-like metadata as text, never as markup (XSS-safe)', async () => {
    vi.spyOn(auditApi, 'getAuditLogs').mockResolvedValue(page([
      { id: 5, action: 'REQUEST_CREATED', entityType: 'REQUEST', entityId: 1, actorUserId: 2,
        metadata: { note: '<img src=x onerror=alert(1)>' }, createdAt: '2026-08-31T10:00:00.000Z' },
    ]));
    const { container } = render(<AuditLogsPage />);
    await waitFor(() => expect(screen.getByRole('cell', { name: 'REQUEST_CREATED' })).toBeInTheDocument());
    expect(container.querySelector('tbody img')).toBeNull();
    expect(screen.getByText(/onerror=alert\(1\)/)).toBeInTheDocument();
  });
});
