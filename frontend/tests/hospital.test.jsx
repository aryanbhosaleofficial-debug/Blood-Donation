import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext } from '../src/context/AuthContext.jsx';
import { CsrfContext } from '../src/context/CsrfContext.jsx';
import { CreateRequestPage } from '../src/pages/hospital/CreateRequestPage.jsx';
import { RequestDetailPage } from '../src/pages/hospital/RequestDetailPage.jsx';
import { requestsApi } from '../src/api/requests.api.js';

const mockHospitalUser = { id: 10, email: 'city.hospital@example.com', role: 'HOSPITAL' };

function renderWithContext(ui, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <CsrfContext.Provider value={{ csrfToken: 'tok', setCsrf: () => {}, fetchCsrf: () => {}, clearCsrf: () => {} }}>
        <AuthContext.Provider
          value={{
            user: mockHospitalUser,
            isAuthenticated: true,
            loading: false,
            login: vi.fn(),
            logout: vi.fn(),
            refreshUser: vi.fn(),
          }}
        >
          {ui}
        </AuthContext.Provider>
      </CsrfContext.Provider>
    </MemoryRouter>,
  );
}

describe('Hospital Emergency Requests Flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('submits emergency request with clientRequestId and navigates to detail', async () => {
    let capturedPayload = null;
    vi.spyOn(requestsApi, 'createRequest').mockImplementation(async (payload) => {
      capturedPayload = payload;
      return {
        request: { id: 42, bloodGroup: payload.bloodGroup, status: 'OPEN' },
        broadcast: { bankCount: 3 },
      };
    });

    renderWithContext(
      <Routes>
        <Route path="/hospital/requests/new" element={<CreateRequestPage />} />
        <Route path="/hospital/requests/42" element={<div>Request 42 Detail</div>} />
      </Routes>,
      { route: '/hospital/requests/new' },
    );

    const submitBtn = screen.getByRole('button', { name: /post emergency request/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(capturedPayload).not.toBeNull();
      expect(capturedPayload.bloodGroup).toBe('A+');
      expect(capturedPayload.component).toBe('RED_CELLS');
      expect(capturedPayload.clientRequestId).toBeDefined();
      expect(screen.getByText('Request 42 Detail')).toBeInTheDocument();
    });
  });

  it('renders request detail with allocations, fallback and pseudonymous pledges', async () => {
    vi.spyOn(requestsApi, 'getRequest').mockResolvedValue({
      request: {
        id: 1,
        bloodGroup: 'O-',
        component: 'RED_CELLS',
        unitsNeeded: 2,
        bankUnitsAllocated: 1,
        remainingBankUnits: 1,
        urgency: 'CRITICAL',
        status: 'OPEN',
        isPastExpiry: false,
        createdAt: '2026-08-30T10:00:00Z',
        expiresAt: '2026-08-30T12:00:00Z',
        donorFallback: { status: 'ACTIVE', potentialDonorsAlerted: 4 },
      },
      broadcast: { bankCount: 5 },
    });

    vi.spyOn(requestsApi, 'getRequestAllocations').mockResolvedValue({
      allocations: [
        {
          id: 101,
          unitsReserved: 1,
          status: 'RESERVED',
          reservedAt: '2026-08-30T10:15:00Z',
          bank: { name: 'Central Blood Bank' },
        },
      ],
    });

    vi.spyOn(requestsApi, 'getRequestPledges').mockResolvedValue({
      activePotentialDonorPledges: 1,
      maxPledgeSlots: 3,
      availablePledgeSlots: 2,
      pledges: [
        {
          publicReference: 'PDG-O9X7K2',
          status: 'PLEDGED',
          etaBand: '15-30m',
          distanceBand: '0-5km',
        },
      ],
    });

    renderWithContext(
      <Routes>
        <Route path="/hospital/requests/:requestId" element={<RequestDetailPage />} />
      </Routes>,
      { route: '/hospital/requests/1' },
    );

    await waitFor(() => {
      expect(screen.getByText('Emergency Request #1')).toBeInTheDocument();
      expect(screen.getByText('Central Blood Bank')).toBeInTheDocument();
      expect(screen.getByText('Potential Donor PDG-O9X7K2')).toBeInTheDocument();
      expect(screen.getByText(/15-30m/)).toBeInTheDocument();
      // Ensure donor private fields are completely absent
      expect(screen.queryByText(/@/)).toBeNull(); // no email
      expect(screen.queryByText(/\+91|phone/i)).toBeNull();
    });
  });
});
