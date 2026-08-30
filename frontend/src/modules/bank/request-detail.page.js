/**
 * frontend/modules/bank/request-detail.page
 *
 * Read-only detail for one incoming request the bank was broadcast.
 */

import { ApiError } from '../../core/api-client.js';
import { bankService, getSelectedRequestId } from './bank.service.js';
import { field, formatTime } from '../hospital/components/request-status.js';

export async function renderBankRequestDetail(outlet, ctx) {
  const navigate = (ctx && ctx.navigate) || (() => {});
  const id = getSelectedRequestId();

  const h = document.createElement('h2');
  h.textContent = id ? `Incoming request #${id}` : 'Incoming request';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const body = document.createElement('div');
  body.className = 'card';
  outlet.append(h, status, body);

  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = 'Back to incoming requests';
  back.addEventListener('click', () => navigate('/bank/incoming-requests'));
  outlet.append(back);

  if (!id) {
    status.textContent = 'No request selected.';
    return;
  }

  try {
    const data = await bankService.incomingRequest(id);
    const r = data.request;
    const hosp = r.hospital || {};
    body.append(
      field('Blood group', r.bloodGroup),
      field('Component', r.component),
      field('Units needed', r.unitsNeeded),
      field('Urgency', r.urgency),
      field('Status', r.status),
      field('Hospital', hosp.name),
      field('Location', [hosp.locality, hosp.city].filter(Boolean).join(', ')),
      field('Created', formatTime(r.createdAt)),
      field('Expires', formatTime(r.expiresAt)),
    );
    status.textContent = '';
  } catch (err) {
    status.textContent = err instanceof ApiError ? `Could not load: ${err.message}` : 'Could not load the request.';
  }
}
