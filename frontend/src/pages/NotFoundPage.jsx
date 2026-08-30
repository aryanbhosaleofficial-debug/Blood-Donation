import React from 'react';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="page-container" style={{ textAlign: 'center', padding: '4rem 1.5rem' }}>
      <h2>Page Not Found</h2>
      <p style={{ color: 'var(--muted)', margin: '1rem 0 2rem' }}>
        The requested page does not exist or has been moved.
      </p>
      <Link to="/" className="btn btn-primary">
        Return to Home
      </Link>
    </div>
  );
}
