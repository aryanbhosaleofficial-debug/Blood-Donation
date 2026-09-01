import React from 'react';
import { AlertCircle, AlertTriangle, Clock } from 'lucide-react';

/**
 * Standard UrgencyBadge Component
 * CRITICAL: Crimson | URGENT: Amber | NORMAL: Neutral Slate
 */
export function UrgencyBadge({ urgency, showIcon = true, className = '' }) {
  if (!urgency) return null;
  const normalized = String(urgency).toUpperCase();

  let icon = null;
  let variant = 'normal';

  if (normalized === 'CRITICAL') {
    variant = 'critical';
    icon = <AlertCircle size={12} />;
  } else if (normalized === 'URGENT') {
    variant = 'urgent';
    icon = <AlertTriangle size={12} />;
  } else {
    variant = 'normal';
    icon = <Clock size={12} />;
  }

  return (
    <span className={`urgency-badge ${variant} ${className}`.trim()}>
      {showIcon && icon}
      {normalized}
    </span>
  );
}
