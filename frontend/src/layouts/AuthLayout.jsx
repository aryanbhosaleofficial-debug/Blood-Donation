import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { HeartHandshake } from 'lucide-react';
import { Footer } from '../components/common/Footer.jsx';
import { ToastProvider } from '../components/common/ToastContext.jsx';

export function AuthLayout() {
  return (
    <ToastProvider>
      <div className="auth-shell">
        <header className="auth-navbar">
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', textDecoration: 'none' }}>
            <div className="brand-icon-wrapper">
              <HeartHandshake size={20} />
            </div>
            <div className="brand-info">
              <span className="brand-name">BloodLink</span>
              <span className="brand-tagline">Emergency Red-Cell Network</span>
            </div>
          </Link>
        </header>

        <main className="auth-canvas">
          <Outlet />
        </main>

        <Footer />
      </div>
    </ToastProvider>
  );
}
