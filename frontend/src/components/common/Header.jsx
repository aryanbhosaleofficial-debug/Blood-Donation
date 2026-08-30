import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';

export function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="app-header">
      <h1>Community Blood Donation Matching System</h1>
      <div className="header-user-section">
        <span className="session-badge">
          {isAuthenticated
            ? `Signed in as ${user.email} (${user.role})`
            : 'Not signed in'}
        </span>
        {isAuthenticated && (
          <button type="button" className="btn btn-secondary" onClick={handleSignOut}>
            Sign out
          </button>
        )}
      </div>
    </header>
  );
}
