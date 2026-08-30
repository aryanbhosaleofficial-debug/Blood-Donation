import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext } from '../src/context/AuthContext.jsx';
import { CsrfContext } from '../src/context/CsrfContext.jsx';
import { DonorAlertDetailPage } from '../src/pages/donor/DonorAlertDetailPage.jsx';
import { DonorPledgeDetailPage } from '../src/pages/donor/DonorPledgeDetailPage.jsx';
import { donorApi } from '../src/api/donor.api.js';
import { pledgesApi } from '../src/api/pledges.api.js';

const mockDonorUser = { id: 30, email: 'donor@example.com', role: 'DONOR' };

function renderWithContext(ui, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <CsrfContext.Provider value={{ csrfToken: 'tok', setCsrf: () => {}, fetchCsrf: () => {}, clearCsrf: () => {} }}>
        <AuthContext.Provider
          value={{
            user: mockDonorUser,
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

describe('Donor Flow & Privacy', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('marks alert as viewed, shows clinical disclaimer, and creates pledge', async () => {
    vi.spyOn(donorApi, 'getAlertDetail').mockResolvedValue({
      alert: {
        id: 7,
        status: 'ACTIVE',
        isActionable: true,
        request: {
          id: 3,
          bloodGroup: 'B+',
          urgency: 'URGENT',
          remainingRequirement: 1,
        },
        hospital: { name: 'City Hospital', city: 'Mumbai', locality: 'Dadar' },
      },
    });

    vi.spyOn(donorApi, 'viewAlert').mockResolvedValue({
      alert: {
        id: 7,
        status: 'VIEWED',
        isActionable: true,
        request: { id: 3, bloodGroup: 'B+', urgency: 'URGENT', remainingRequirement: 1 },
        hospital: { name: 'City Hospital', city: 'Mumbai', locality: 'Dadar' },
      },
    });

    vi.spyOn(pledgesApi, 'createPledge').mockResolvedValue({
      pledge: { id: 99, publicReference: 'PDG-T3K9Q1', status: 'PLEDGED' },
    });

    renderWithContext(
      <Routes>
        <Route path="/donor/alerts/:alertId" element={<DonorAlertDetailPage />} />
        <Route path="/donor/pledges/:pledgeId" element={<div>Pledge 99 Active</div>} />
      </Routes>,
      { route: '/donor/alerts/7' },
    );

    await waitFor(() => {
      expect(donorApi.viewAlert).toHaveBeenCalledWith('7');
      expect(screen.getByText('B+')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /pledge to respond/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /pledge to respond/i }));

    await waitFor(() => {
      expect(pledgesApi.createPledge).toHaveBeenCalledWith('7');
      expect(screen.getByText('Pledge 99 Active')).toBeInTheDocument();
    });
  });

  it('manages pledge lifecycle: mark arrived and location sharing', async () => {
    vi.spyOn(pledgesApi, 'getPledgeDetail').mockResolvedValue({
      pledge: {
        id: 99,
        publicReference: 'PDG-T3K9Q1',
        status: 'PLEDGED',
        pledgedAt: '2026-08-30T10:00:00Z',
        hospital: { name: 'City Hospital', city: 'Mumbai' },
        request: { bloodGroup: 'B+', urgency: 'URGENT' },
        locationSharing: { isActive: false },
      },
    });

    vi.spyOn(pledgesApi, 'arrivePledge').mockResolvedValue({
      pledge: { id: 99, publicReference: 'PDG-T3K9Q1', status: 'ARRIVED' },
    });

    renderWithContext(
      <Routes>
        <Route path="/donor/pledges/:pledgeId" element={<DonorPledgeDetailPage />} />
      </Routes>,
      { route: '/donor/pledges/99' },
    );

    await waitFor(() => {
      expect(screen.getByText('PDG-T3K9Q1')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /mark arrived/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /start location sharing/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /mark arrived/i }));

    await waitFor(() => {
      expect(pledgesApi.arrivePledge).toHaveBeenCalledWith('99');
    });
  });
});
