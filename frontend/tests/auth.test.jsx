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
import { ApiError } from '../src/api/api-client.js';
import { useAuth } from '../src/hooks/useAuth.js';

function AuthStateProbe() {
  const { authStatus, user } = useAuth();
  return <div>{authStatus}:{user?.email || 'none'}</div>;
}

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

  it('toggles password visibility without clearing the controlled value', async () => {
    vi.spyOn(authApi, 'getMe').mockResolvedValue({ user: null });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <CsrfProvider>
          <AuthProvider><LoginPage /></AuthProvider>
        </CsrfProvider>
      </MemoryRouter>,
    );

    const passwordInput = screen.getByLabelText(/^password$/i);
    await userEvent.type(passwordInput, 'MyPassword123!');
    expect(passwordInput).toHaveAttribute('type', 'password');

    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(passwordInput).toHaveValue('MyPassword123!');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(passwordInput).toHaveValue('MyPassword123!');
  });

  it('treats a logged-out /auth/me 401 as unauthenticated and does not fetch CSRF', async () => {
    const getMe = vi.spyOn(authApi, 'getMe').mockRejectedValue(
      new ApiError('UNAUTHORIZED', 'You must be signed in.', 401),
    );
    const getCsrf = vi.spyOn(authApi, 'getCsrfToken');

    render(
      <React.StrictMode>
        <CsrfProvider>
          <AuthProvider><AuthStateProbe /></AuthProvider>
        </CsrfProvider>
      </React.StrictMode>,
    );

    expect(await screen.findByText('unauthenticated:none')).toBeInTheDocument();
    expect(getMe).toHaveBeenCalledTimes(1);
    expect(getCsrf).not.toHaveBeenCalled();
    expect(getCsrfToken()).toBeNull();
  });

  it('bootstraps a logged-in session once and fetches CSRF after /auth/me', async () => {
    const calls = [];
    const mockUser = { id: 7, email: 'donor@example.com', role: 'DONOR' };
    const getMe = vi.spyOn(authApi, 'getMe').mockImplementation(async () => {
      calls.push('me');
      return { user: mockUser };
    });
    const getCsrf = vi.spyOn(authApi, 'getCsrfToken').mockImplementation(async () => {
      calls.push('csrf');
      return { csrfToken: 'bootstrap-token' };
    });

    render(
      <React.StrictMode>
        <CsrfProvider>
          <AuthProvider><AuthStateProbe /></AuthProvider>
        </CsrfProvider>
      </React.StrictMode>,
    );

    expect(await screen.findByText('authenticated:donor@example.com')).toBeInTheDocument();
    expect(getMe).toHaveBeenCalledTimes(1);
    expect(getCsrf).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['me', 'csrf']);
    expect(getCsrfToken()).toBe('bootstrap-token');
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
    const passwordInput = screen.getByLabelText(/^password$/i);
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
    const passwordInput = screen.getByLabelText(/^password$/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await userEvent.type(emailInput, 'unknown@example.com');
    await userEvent.type(passwordInput, 'wrong-password');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
    });
  });
});
