import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext } from '../src/context/AuthContext.jsx';
import { CsrfContext } from '../src/context/CsrfContext.jsx';
import { InventoryPage } from '../src/pages/blood-bank/InventoryPage.jsx';
import { AllocationHistoryPage } from '../src/pages/blood-bank/AllocationHistoryPage.jsx';
import { bloodBankApi } from '../src/api/blood-bank.api.js';
import { allocationsApi } from '../src/api/allocations.api.js';

const mockBankUser = { id: 20, email: 'bank@example.com', role: 'BLOOD_BANK' };

function renderWithContext(ui, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <CsrfContext.Provider value={{ csrfToken: 'tok', setCsrf: () => {}, fetchCsrf: () => {}, clearCsrf: () => {} }}>
        <AuthContext.Provider
          value={{
            user: mockBankUser,
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

describe('Blood Bank Flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders red-cell inventory and handles version conflict with reload', async () => {
    let callCount = 0;
    vi.spyOn(bloodBankApi, 'getInventory').mockImplementation(async () => {
      callCount += 1;
      if (callCount === 1) {
        return {
          inventory: [
            {
              id: 1,
              bloodGroup: 'O-',
              component: 'RED_CELLS',
              unitsAvailable: 5,
              version: 1,
              isStale: false,
              updatedAt: '2026-08-30T10:00:00Z',
            },
          ],
        };
      }
      return {
        inventory: [
          {
            id: 1,
            bloodGroup: 'O-',
            component: 'RED_CELLS',
            unitsAvailable: 8,
            version: 2,
            isStale: false,
            updatedAt: '2026-08-30T10:05:00Z',
          },
        ],
      };
    });

    vi.spyOn(bloodBankApi, 'updateInventory').mockRejectedValue({
      code: 'INVENTORY_VERSION_CONFLICT',
      message: 'Version conflict',
    });

    renderWithContext(<InventoryPage />);

    await waitFor(() => {
      expect(screen.getByText('O-')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    const editBtn = screen.getByRole('button', { name: /edit/i });
    await userEvent.click(editBtn);

    const submitBtn = screen.getByRole('button', { name: /confirm adjustment/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/inventory changed in another session/i)).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument(); // Reloaded fresh value
    });
  });

  it('renders allocations and executes release and complete actions', async () => {
    vi.spyOn(allocationsApi, 'getBankAllocations').mockResolvedValue({
      allocations: [
        {
          id: 50,
          requestId: 10,
          request: { id: 10, bloodGroup: 'A+' },
          unitsReserved: 2,
          status: 'RESERVED',
          reservedAt: '2026-08-30T10:00:00Z',
        },
      ],
    });

    vi.spyOn(allocationsApi, 'releaseAllocation').mockResolvedValue({ status: 'RELEASED' });

    renderWithContext(<AllocationHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText('#10')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /release/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /release/i }));

    await waitFor(() => {
      expect(allocationsApi.releaseAllocation).toHaveBeenCalledWith(50);
      expect(screen.getByText(/released and stock restored/i)).toBeInTheDocument();
    });
  });
});
