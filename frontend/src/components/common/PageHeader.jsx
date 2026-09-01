import React from 'react';

/**
 * Standardized PageHeader component
 */
export function PageHeader({ title, description, actions = null, breadcrumb = null }) {
  return (
    <div className="page-header">
      <div className="page-header-text">
        {breadcrumb}
        <h2 className="page-header-title">{title}</h2>
        {description && <p className="page-header-description">{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}
