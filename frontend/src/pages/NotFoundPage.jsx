import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion, ArrowLeft } from 'lucide-react';
import { EmptyState } from '../components/common/EmptyState.jsx';

export function NotFoundPage() {
  return (
    <div className="page-container" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <EmptyState
        icon={<FileQuestion size={36} />}
        title="Page Not Found (404)"
        description="The operational screen or resource you requested does not exist or has been moved."
        action={
          <Link to="/" className="btn btn-primary" style={{ display: 'inline-flex' }}>
            <ArrowLeft size={16} /> Return to Home
          </Link>
        }
      />
    </div>
  );
}
