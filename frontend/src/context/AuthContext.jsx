import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { authApi } from '../api/auth.api.js';
import { bootstrapAuthSession } from '../api/auth-bootstrap.js';
import { setUnauthorizedHandler } from '../api/api-client.js';
import { useCsrf } from '../hooks/useCsrf.js';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authStatus, setAuthStatus] = useState('loading');
  const operationRef = useRef(0);
  const mountedRef = useRef(false);
  const { setCsrf, fetchCsrf, clearCsrf } = useCsrf();

  const handleUnauthorized = useCallback(() => {
    operationRef.current += 1;
    setUser(null);
    setAuthStatus('unauthenticated');
    clearCsrf();
  }, [clearCsrf]);

  useEffect(() => {
    setUnauthorizedHandler(handleUnauthorized);
    return () => setUnauthorizedHandler(null);
  }, [handleUnauthorized]);

  const bootstrap = useCallback(async () => {
    const operation = ++operationRef.current;
    setAuthStatus('loading');
    try {
      const result = await bootstrapAuthSession();
      if (!mountedRef.current || operation !== operationRef.current) return null;

      if (result.status === 'authenticated') {
        setUser(result.user);
        if (result.csrfToken) setCsrf(result.csrfToken);
        else clearCsrf();
        setAuthStatus('authenticated');
        return result.user;
      } else {
        setUser(null);
        clearCsrf();
        setAuthStatus('unauthenticated');
        return null;
      }
    } catch {
      if (!mountedRef.current || operation !== operationRef.current) return null;
      setUser(null);
      clearCsrf();
      setAuthStatus('unauthenticated');
      return null;
    }
  }, [setCsrf, clearCsrf]);

  useEffect(() => {
    mountedRef.current = true;
    bootstrap();
    return () => {
      mountedRef.current = false;
    };
  }, [bootstrap]);

  const login = useCallback(
    async (email, password) => {
      const operation = ++operationRef.current;
      const data = await authApi.login({ email, password });
      const authenticatedUser = data && data.user ? data.user : null;
      if (!mountedRef.current || operation !== operationRef.current) return null;
      setUser(authenticatedUser);
      if (authenticatedUser) {
        await fetchCsrf();
        if (mountedRef.current && operation === operationRef.current) {
          setAuthStatus('authenticated');
        }
      } else {
        clearCsrf();
        setAuthStatus('unauthenticated');
      }
      return authenticatedUser;
    },
    [fetchCsrf, clearCsrf],
  );

  const logout = useCallback(async () => {
    operationRef.current += 1;
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      clearCsrf();
      setAuthStatus('unauthenticated');
    }
  }, [clearCsrf]);

  const refreshUser = useCallback(async () => {
    const operation = ++operationRef.current;
    try {
      const data = await authApi.getMe();
      if (!mountedRef.current || operation !== operationRef.current) return null;
      if (data && data.user) {
        setUser(data.user);
        setAuthStatus('authenticated');
        return data.user;
      }
      setUser(null);
      clearCsrf();
      setAuthStatus('unauthenticated');
      return null;
    } catch {
      if (!mountedRef.current || operation !== operationRef.current) return null;
      setUser(null);
      clearCsrf();
      setAuthStatus('unauthenticated');
      return null;
    }
  }, [clearCsrf]);

  const value = {
    user,
    authStatus,
    loading: authStatus === 'loading',
    isAuthenticated: authStatus === 'authenticated',
    login,
    logout,
    refreshUser,
    bootstrap,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
