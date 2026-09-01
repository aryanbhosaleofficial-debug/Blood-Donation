import React from 'react';
import { Info, ShieldAlert, AlertTriangle } from 'lucide-react';

export function InfoBanner({
  children,
  variant = 'default',
  icon = null,
  className = '',
  style = {},
}) {
  let defaultIcon = <Info size={18} style={{ flexShrink: 0, color: 'var(--color-primary-700)', marginTop: 2 }} />;
  if (variant === 'warning') {
    defaultIcon = <AlertTriangle size={18} style={{ flexShrink: 0, color: 'var(--color-warning)', marginTop: 2 }} />;
  } else if (variant === 'info') {
    defaultIcon = <Info size={18} style={{ flexShrink: 0, color: 'var(--color-info)', marginTop: 2 }} />;
  }

  return (
    <div className={`info-banner ${variant} ${className}`.trim()} style={style}>
      {icon || defaultIcon}
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
