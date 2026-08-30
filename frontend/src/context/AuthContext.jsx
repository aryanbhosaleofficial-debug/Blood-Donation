import React, { createContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/auth.api.js';
import { setUnauthorizedHandler } from '../api/api-client.js';
import { useCsrf } from '../hooks/useCsrf.js';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { fetchCsrf, clearCsrf } = useCsrf();

  const handleUnauthorized = useCallback(() => {
    setUser(null);
    clearCsrf();
  }, [clearCsrf]);

  useEffect(() => {
    setUnauthorizedHandler(handleUnauthorized);
  }, [handleUnauthorized]);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authApi.getMe();
      if (data && data.user) {
        setUser(data.user);
        await fetchCsrf();
      } else {
        setUser(null);
        clearCsrf();
      }
    } catch {
      setUser(null);
      clearCsrf();
    } finally {
      setLoading(false);
    }
  }, [fetchCsrf, clearCsrf]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = useCallback(
    async (email, password) => {
      const data = await authApi.login({ email, password });
      const authenticatedUser = data && data.user ? data.user : null;
      setUser(authenticatedUser);
      if (authenticatedUser) {
        await fetchCsrf();
      }
      return authenticatedUser;
    },
    [fetchCsrf],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      clearCsrf();
    }
  }, [clearCsrf]);

  const refreshUser = useCallback(async () => {
    try {
      const data = await authApi.getMe();
      if (data && data.user) {
        setUser(data.user);
        return data.user;
      }
      setUser(null);
      clearCsrf();
      return null;
    } catch {
      setUser(null);
      clearCsrf();
      return null;
    }
  }, [clearCsrf]);

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    login,
    logout,
    refreshUser,
    bootstrap,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
