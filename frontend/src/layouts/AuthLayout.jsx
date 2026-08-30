import React from 'react';
import { Outlet } from 'react-router-dom';
import { Footer } from '../components/common/Footer.jsx';

export function AuthLayout() {
  return (
    <div className="auth-shell">
      <header className="app-header">
        <h1>Community Blood Donation Matching System</h1>
      </header>
      <main className="auth-page-wrapper">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
