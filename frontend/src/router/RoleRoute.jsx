import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { LoadingSpinner } from '../components/common/LoadingSpinner.jsx';

export function RoleRoute({ allowedRoles, children }) {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return <LoadingSpinner message="Checking permissions…" />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    // Redirect to the user's role landing page
    const roleLanding =
      user.role === 'HOSPITAL'
        ? '/hospital'
        : user.role === 'BLOOD_BANK'
          ? '/blood-bank'
          : user.role === 'DONOR'
            ? '/donor'
            : user.role === 'ADMIN'
              ? '/admin/organizations'
              : '/';
    return <Navigate to={roleLanding} replace />;
  }

  return children;
}
