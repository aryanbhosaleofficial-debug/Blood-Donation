import { useContext } from 'react';
import { CsrfContext } from '../context/CsrfContext.jsx';

export function useCsrf() {
  const context = useContext(CsrfContext);
  if (!context) {
    throw new Error('useCsrf must be used within a CsrfProvider');
  }
  return context;
}
