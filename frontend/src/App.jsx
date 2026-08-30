import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { CsrfProvider } from './context/CsrfContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { AppRouter } from './router/AppRouter.jsx';

export function App() {
  return (
    <BrowserRouter>
      <CsrfProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </CsrfProvider>
    </BrowserRouter>
  );
}

export default App;
