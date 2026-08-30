import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SurgeDashboardPage } from '../src/pages/admin/SurgeDashboardPage.jsx';
import { SurgeDetailPage } from '../src/pages/admin/SurgeDetailPage.jsx';
import { RoleRoute } from '../src/router/RoleRoute.jsx';
import { AuthContext } from '../src/context/AuthContext.jsx';
import { surgeApi } from '../src/api/surge.api.js';

const candidate = (over = {}) => ({
  id: 15, status: 'PENDING', mode: 'DEMO', city: 'Ahmedabad', bloodGroup: 'O-', component: 'RED_CELLS',
  window: { startedAt: '2026-08-31T09:00:00.000Z', endedAt: '2026-08-31T10:00:00.000Z' },
  observedRequests: 8, expectedRequests: 1, poissonTailProbability: 0.0008,
  distinctHospitals: 3, velocityRatio: 4, previousWindowRequests: 2,
  geographic: { signal: 'CONCENTRATED', radiusKm: 8.4 },
  inventory: { recordedUnits: 4, freshRows: 3, staleRows: 1, depletionUnits: 9 },
  signalScore: 86, baselineSource: 'SYNTHETIC', isSynthetic: true,
  detectedAt: '2026-08-31T10:00:05.000Z', reviewedAt: null, reviewedByUserId: null, reviewNote: null,
  ...over,
});

describe('Admin — Surge dashboard', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('shows loading then a candidate list with the DEMO badge', async () => {
    vi.spyOn(surgeApi, 'getCandidates').mockResolvedValue({ candidates: [candidate()], pagination: {} });
    vi.spyOn(surgeApi, 'getEvents').mockResolvedValue({ events: [], pagination: {} });
    render(<MemoryRouter><SurgeDashboardPage /></MemoryRouter>);
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
    await waitFor(() => expect(screen.getByRole('link', { name: '#15' })).toBeInTheDocument());
    expect(screen.getByText('DEMO')).toBeInTheDocument();
    expect(screen.getByText('Ahmedabad')).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    vi.spyOn(surgeApi, 'getCandidates').mockResolvedValue({ candidates: [], pagination: {} });
    vi.spyOn(surgeApi, 'getEvents').mockResolvedValue({ events: [], pagination: {} });
    render(<MemoryRouter><SurgeDashboardPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/no surge candidates/i)).toBeInTheDocument());
  });

  it('shows an error state with retry', async () => {
    vi.spyOn(surgeApi, 'getCandidates').mockRejectedValue(new Error('boom'));
    vi.spyOn(surgeApi, 'getEvents').mockRejectedValue(new Error('boom'));
    render(<MemoryRouter><SurgeDashboardPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('applies a status filter', async () => {
    const spy = vi.spyOn(surgeApi, 'getCandidates').mockResolvedValue({ candidates: [], pagination: {} });
    vi.spyOn(surgeApi, 'getEvents').mockResolvedValue({ events: [], pagination: {} });
    render(<MemoryRouter><SurgeDashboardPage /></MemoryRouter>);
    await waitFor(() => expect(spy).toHaveBeenCalled());
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'CONFIRMED');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => {
      const last = spy.mock.calls.at(-1)[0];
      expect(last.status).toBe('CONFIRMED');
    });
  });

  it('uses safe wording (no disaster claims)', async () => {
    vi.spyOn(surgeApi, 'getCandidates').mockResolvedValue({ candidates: [], pagination: {} });
    vi.spyOn(surgeApi, 'getEvents').mockResolvedValue({ events: [], pagination: {} });
    const { container } = render(<MemoryRouter><SurgeDashboardPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Surge Detection')).toBeInTheDocument());
    expect(container.textContent).not.toMatch(/disaster detected|mass casualty|crisis predicted/i);
  });
});

describe('Admin — Surge detail', () => {
  beforeEach(() => vi.restoreAllMocks());

  const renderDetail = (id = '15') =>
    render(
      <MemoryRouter initialEntries={[`/admin/surge/candidates/${id}`]}>
        <Routes>
          <Route path="/admin/surge/candidates/:candidateId" element={<SurgeDetailPage />} />
          <Route path="/admin/surge" element={<div>dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

  it('renders evidence, statistical wording, and review buttons for a PENDING candidate', async () => {
    vi.spyOn(surgeApi, 'getCandidate').mockResolvedValue({ candidate: candidate(), event: null });
    renderDetail();
    await waitFor(() => expect(screen.getByText('Candidate Summary')).toBeInTheDocument());
    expect(screen.getByText(/probability of observing this many or more requests/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm operational surge/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reject candidate/i })).toBeInTheDocument();
  });

  it('confirms a candidate (with the operational-surge confirm dialog)', async () => {
    vi.spyOn(surgeApi, 'getCandidate').mockResolvedValue({ candidate: candidate(), event: null });
    const confirmSpy = vi.spyOn(surgeApi, 'confirmCandidate').mockResolvedValue({
      candidate: candidate({ status: 'CONFIRMED' }), event: { id: 3, status: 'ACTIVE' },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderDetail();
    await waitFor(() => screen.getByRole('button', { name: /confirm operational surge/i }));
    await userEvent.click(screen.getByRole('button', { name: /confirm operational surge/i }));
    await waitFor(() => expect(confirmSpy).toHaveBeenCalledWith('15', undefined));
    await waitFor(() => expect(screen.getByText(/operational surge event #3/i)).toBeInTheDocument());
  });

  it('rejects a candidate with a note', async () => {
    vi.spyOn(surgeApi, 'getCandidate').mockResolvedValue({ candidate: candidate(), event: null });
    const rejectSpy = vi.spyOn(surgeApi, 'rejectCandidate').mockResolvedValue({ candidate: candidate({ status: 'REJECTED' }) });
    renderDetail();
    await waitFor(() => screen.getByRole('button', { name: /reject candidate/i }));
    await userEvent.type(screen.getByRole('textbox'), 'known test exercise');
    await userEvent.click(screen.getByRole('button', { name: /reject candidate/i }));
    await waitFor(() => expect(rejectSpy).toHaveBeenCalledWith('15', 'known test exercise'));
  });

  it('renders HTML-like city / note values as text (XSS-safe)', async () => {
    vi.spyOn(surgeApi, 'getCandidate').mockResolvedValue({
      candidate: candidate({ status: 'REJECTED', city: '<img src=x onerror=alert(1)>', reviewNote: '<script>alert(2)</script>' }),
      event: null,
    });
    const { container } = render(
      <MemoryRouter initialEntries={['/admin/surge/candidates/15']}>
        <Routes><Route path="/admin/surge/candidates/:candidateId" element={<SurgeDetailPage />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('Candidate Summary')).toBeInTheDocument());
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText(/onerror=alert\(1\)/)).toBeInTheDocument();
  });
});

describe('Admin — Surge route protection (AW)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('redirects a non-admin away from /admin/surge (backend stays authoritative)', async () => {
    const auth = {
      user: { id: 5, email: 'd@x.com', role: 'DONOR' },
      isAuthenticated: true, loading: false,
      login: vi.fn(), logout: vi.fn(), refreshUser: vi.fn(),
    };
    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/admin/surge']}>
          <Routes>
            <Route path="/admin/surge" element={<RoleRoute allowedRoles={['ADMIN']}><SurgeDashboardPage /></RoleRoute>} />
            <Route path="/donor" element={<div>donor landing</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    await waitFor(() => expect(screen.getByText('donor landing')).toBeInTheDocument());
    expect(screen.queryByText('Surge Detection')).toBeNull();
  });
});
