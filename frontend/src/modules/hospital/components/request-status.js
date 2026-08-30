/**
 * frontend/modules/hospital/components/request-status
 *
 * Small helpers to render request fields safely (textContent only) and to
 * format timestamps in the browser's locale.
 */

export function formatTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString();
}

export function statusBadge(request) {
  const span = document.createElement('span');
  span.className = `status-badge status-${String(request.status).toLowerCase()}`;
  let text = request.status;
  if (request.status === 'OPEN' && request.isPastExpiry) text = 'OPEN (past expiry)';
  span.textContent = text;
  return span;
}

export function field(label, value) {
  const wrap = document.createElement('div');
  wrap.className = 'row';
  const k = document.createElement('span');
  k.className = 'k';
  k.textContent = label;
  const v = document.createElement('span');
  v.className = 'v';
  if (value instanceof Node) v.append(value);
  else v.textContent = value === null || value === undefined || value === '' ? '-' : String(value);
  wrap.append(k, v);
  return wrap;
}
