import React from 'react';

/**
 * Reusable Button Component
 * 
 * @param {('primary'|'emergency'|'secondary'|'danger'|'danger-solid'|'success'|'ghost')} variant
 * @param {('sm'|'md'|'lg')} size
 * @param {boolean} loading
 * @param {React.ReactNode} icon
 */
export function Button({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon = null,
  className = '',
  onClick,
  ...rest
}) {
  const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';
  const variantClass = `btn-${variant}`;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`btn ${variantClass} ${sizeClass} ${className}`.trim()}
      {...rest}
    >
      {loading && <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
      {!loading && icon}
      {children}
    </button>
  );
}
