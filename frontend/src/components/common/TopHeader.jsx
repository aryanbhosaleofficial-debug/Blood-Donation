import React from 'react';
import { Menu, LogOut, ShieldCheck, Heart } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { NotificationBell } from './NotificationBell.jsx';
import { Button } from './Button.jsx';

export function TopHeader({ onToggleMobileMenu }) {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path.startsWith('/hospital')) return 'Hospital Portal';
    if (path.startsWith('/blood-bank')) return 'Blood Bank Portal';
    if (path.startsWith('/donor')) return 'Donor Portal';
    if (path.startsWith('/admin')) return 'Admin Console';
    return 'BloodLink Platform';
  };

  return (
    <header className="top-header">
      <div className="header-left">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={onToggleMobileMenu}
          aria-label="Open navigation menu"
        >
          <Menu size={22} />
        </button>

        <div className="header-breadcrumbs">
          <span>{getBreadcrumb()}</span>
        </div>
      </div>

      <div className="header-right">
        {isAuthenticated && user ? (
          <>
            <div className="header-role-indicator">
              <span className="role-dot" />
              <span>{user.role}</span>
            </div>

            <NotificationBell />

            <Button
              variant="secondary"
              size="sm"
              onClick={handleSignOut}
              icon={<LogOut size={14} />}
            >
              Sign out
            </Button>
          </>
        ) : (
          <Link to="/login" className="btn btn-primary btn-sm">
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}
