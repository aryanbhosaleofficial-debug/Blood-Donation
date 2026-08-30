import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { CsrfProvider } from '../src/context/CsrfContext.jsx';
import { LoginPage } from '../src/pages/auth/LoginPage.jsx';
import { getCsrfToken, setCsrfToken, clearCsrfToken } from '../src/api/csrf-token.js';
import { authApi } from '../src/api/auth.api.js';

describe('Auth Flow & Security', () => {
  beforeEach(() => {
    clearCsrfToken();
    vi.restoreAllMocks();
  });

  it('maintains CSRF token in memory and clears it on demand', () => {
    expect(getCsrfToken()).toBeNull();
    setCsrfToken('mock-csrf-token-12345');
    expect(getCsrfToken()).toBe('mock-csrf-token-12345');
    clearCsrfToken();
    expect(getCsrfToken()).toBeNull();
    expect(localStorage.getItem('csrfToken')).toBeNull();
    expect(sessionStorage.getItem('csrfToken')).toBeNull();
  });

  it('renders login form and submits credentials successfully', async () => {
    const mockUser = { id: 1, email: 'hospital@example.com', role: 'HOSPITAL' };
    vi.spyOn(authApi, 'getMe').mockResolvedValue({ user: null });
    vi.spyOn(authApi, 'login').mockResolvedValue({ user: mockUser });
    vi.spyOn(authApi, 'getCsrfToken').mockResolvedValue({ csrfToken: 'new-csrf-token' });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <CsrfProvider>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/hospital" element={<div>Hospital Home</div>} />
            </Routes>
          </AuthProvider>
        </CsrfProvider>
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await userEvent.type(emailInput, 'hospital@example.com');
    await userEvent.type(passwordInput, 'ValidPassword123!');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({
        email: 'hospital@example.com',
        password: 'ValidPassword123!',
      });
      expect(getCsrfToken()).toBe('new-csrf-token');
      expect(screen.getByText('Hospital Home')).toBeInTheDocument();
    });
  });

  it('displays generic error on invalid login without disclosing details', async () => {
    vi.spyOn(authApi, 'getMe').mockResolvedValue({ user: null });
    vi.spyOn(authApi, 'login').mockRejectedValue(new Error('INVALID_CREDENTIALS'));

    render(
      <MemoryRouter initialEntries={['/login']}>
        <CsrfProvider>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </CsrfProvider>
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await userEvent.type(emailInput, 'unknown@example.com');
    await userEvent.type(passwordInput, 'wrong-password');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
    });
  });
});
