import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Header } from '../components/common/Header.jsx';
import { Footer } from '../components/common/Footer.jsx';
import { useAuth } from '../hooks/useAuth.js';

export function AppLayout() {
  const { user } = useAuth();

  const getNavLinks = () => {
    if (!user) return [];
    switch (user.role) {
      case 'HOSPITAL':
        return [
          { label: 'Dashboard', path: '/hospital' },
          { label: 'Profile', path: '/hospital/profile' },
          { label: 'Create Request', path: '/hospital/requests/new' },
          { label: 'My Requests', path: '/hospital/requests' },
        ];
      case 'BLOOD_BANK':
        return [
          { label: 'Profile', path: '/blood-bank/profile' },
          { label: 'Inventory', path: '/blood-bank/inventory' },
          { label: 'Incoming Requests', path: '/blood-bank/requests' },
          { label: 'My Allocations', path: '/blood-bank/allocations' },
        ];
      case 'DONOR':
        return [
          { label: 'Dashboard', path: '/donor' },
          { label: 'Profile', path: '/donor/profile' },
          { label: 'Availability', path: '/donor/availability' },
          { label: 'Alerts', path: '/donor/alerts' },
          { label: 'My Pledges', path: '/donor/pledges' },
        ];
      case 'ADMIN':
        return [
          { label: 'Organization Verification', path: '/admin/organizations' },
          { label: 'Operational Metrics', path: '/admin/metrics' },
          { label: 'Audit Logs', path: '/admin/audit-logs' },
          { label: 'Surge Detection', path: '/admin/surge' },
        ];
      default:
        return [];
    }
  };

  const navLinks = getNavLinks();

  return (
    <div className="app-shell">
      <Header />
      {navLinks.length > 0 && (
        <nav className="role-nav" aria-label="Role navigation">
          {navLinks.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              end={link.path === '/hospital' || link.path === '/donor'}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      )}
      <main className="app-main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
