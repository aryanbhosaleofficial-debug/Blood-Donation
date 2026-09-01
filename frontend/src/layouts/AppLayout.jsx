import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/common/Sidebar.jsx';
import { TopHeader } from '../components/common/TopHeader.jsx';
import { Footer } from '../components/common/Footer.jsx';
import { ToastProvider } from '../components/common/ToastContext.jsx';

export function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="app-shell">
        <Sidebar
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />
        <div className="app-content-wrapper">
          <TopHeader
            onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
          />
          <main className="app-main" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Outlet />
          </main>
          <Footer />
        </div>
      </div>
    </ToastProvider>
  );
}
