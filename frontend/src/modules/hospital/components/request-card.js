/**
 * frontend/modules/hospital/components/request-card
 *
 * One row in the hospital's request list. All dynamic text via textContent.
 */

import { formatTime, statusBadge } from './request-status.js';

export function requestCard(request, { onOpen }) {
  const card = document.createElement('article');
  card.className = 'request-card';

  const head = document.createElement('div');
  head.className = 'request-card__head';
  const title = document.createElement('strong');
  title.textContent = `${request.bloodGroup} · ${request.unitsNeeded} unit(s) · ${request.urgency}`;
  head.append(title, statusBadge(request));

  const meta = document.createElement('p');
  meta.className = 'request-card__meta';
  meta.textContent = `Created ${formatTime(request.createdAt)} · expires ${formatTime(request.expiresAt)}`;

  const open = document.createElement('button');
  open.type = 'button';
  open.textContent = 'View';
  open.addEventListener('click', () => onOpen(request.id));

  card.append(head, meta, open);
  return card;
}
