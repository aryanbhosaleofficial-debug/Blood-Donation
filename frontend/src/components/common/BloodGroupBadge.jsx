import React from 'react';

/**
 * Visual badge for blood groups (e.g. O-, A+, B+, AB-)
 */
export function BloodGroupBadge({ bloodGroup, size = 'md', className = '' }) {
  if (!bloodGroup) return null;
  const sizeClass = size === 'lg' ? 'lg' : '';

  return (
    <span className={`blood-group-badge ${sizeClass} ${className}`.trim()}>
      {bloodGroup}
    </span>
  );
}
