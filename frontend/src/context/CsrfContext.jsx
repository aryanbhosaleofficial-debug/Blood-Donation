import React, { createContext, useState, useCallback, useEffect } from 'react';
import { getCsrfToken, setCsrfToken as setMemoryCsrfToken, clearCsrfToken } from '../api/csrf-token.js';
import { authApi } from '../api/auth.api.js';

export const CsrfContext = createContext(null);

export function CsrfProvider({ children }) {
  const [token, setTokenState] = useState(() => getCsrfToken());

  const setCsrf = useCallback((newToken) => {
    setMemoryCsrfToken(newToken);
    setTokenState(newToken || null);
  }, []);

  const clearCsrf = useCallback(() => {
    clearCsrfToken();
    setTokenState(null);
  }, []);

  const fetchCsrf = useCallback(async () => {
    try {
      const data = await authApi.getCsrfToken();
      if (data && data.csrfToken) {
        setCsrf(data.csrfToken);
        return data.csrfToken;
      }
      return null;
    } catch {
      clearCsrf();
      return null;
    }
  }, [setCsrf, clearCsrf]);

  useEffect(() => {
    setMemoryCsrfToken(token);
  }, [token]);

  const value = {
    csrfToken: token,
    setCsrf,
    fetchCsrf,
    clearCsrf,
  };

  return <CsrfContext.Provider value={value}>{children}</CsrfContext.Provider>;
}
