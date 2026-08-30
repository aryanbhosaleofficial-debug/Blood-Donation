/**
 * frontend/modules/bank/components/incoming-request-card
 *
 * One actionable incoming request as seen by a blood bank.
 */

function fmt(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString();
}

export function incomingRequestCard(request, { onOpen }) {
  const card = document.createElement('article');
  card.className = `request-card urgency-${String(request.urgency).toLowerCase()}`;

  const title = document.createElement('strong');
  title.textContent = `${request.bloodGroup} · ${request.unitsNeeded} unit(s) · ${request.urgency}`;

  const hospital = document.createElement('p');
  hospital.className = 'request-card__meta';
  const h = request.hospital || {};
  hospital.textContent = `${h.name || 'Hospital'} — ${[h.locality, h.city].filter(Boolean).join(', ') || 'location not shared'}`;

  const times = document.createElement('p');
  times.className = 'request-card__meta';
  times.textContent = `Created ${fmt(request.createdAt)} · expires ${fmt(request.expiresAt)}`;
  const coverage = document.createElement('p');
  coverage.className = 'request-card__meta';
  coverage.textContent = `Allocated ${request.bankUnitsAllocated} · remaining ${request.remainingBankUnits}`;

  const view = document.createElement('button');
  view.type = 'button';
  view.textContent = 'View details';
  view.addEventListener('click', () => onOpen(request.id));

  card.append(title, hospital, coverage, times, view);
  return card;
}
