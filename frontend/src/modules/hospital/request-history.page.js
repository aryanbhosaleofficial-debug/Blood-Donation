/**
 * frontend/modules/hospital/request-history.page
 *
 * Hospital's own requests, newest first, with an optional status filter.
 */

import { ApiError } from '../../core/api-client.js';
import { hospitalService, setSelectedRequestId } from './hospital.service.js';
import { requestCard } from './components/request-card.js';

const STATUSES = ['', 'OPEN', 'COVERED', 'COMPLETED', 'CANCELLED', 'EXPIRED'];

export async function renderRequestHistory(outlet, ctx) {
  const navigate = (ctx && ctx.navigate) || (() => {});

  const h = document.createElement('h2');
  h.textContent = 'My emergency requests';

  const filter = document.createElement('select');
  for (const s of STATUSES) {
    const o = document.createElement('option');
    o.value = s;
    o.textContent = s || 'All statuses';
    filter.append(o);
  }

  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const listEl = document.createElement('div');
  listEl.className = 'request-list';

  outlet.append(h, filter, status, listEl);

  async function load() {
    status.textContent = 'Loading…';
    listEl.replaceChildren();
    try {
      const data = await hospitalService.listRequests(filter.value || undefined);
      status.textContent = data.requests.length ? '' : 'No requests yet.';
      for (const request of data.requests) {
        listEl.append(
          requestCard(request, {
            onOpen: (id) => {
              setSelectedRequestId(id);
              navigate('/hospital/request-detail');
            },
          }),
        );
      }
    } catch (err) {
      status.textContent = err instanceof ApiError ? `Could not load requests: ${err.message}` : 'Could not load requests.';
    }
  }

  filter.addEventListener('change', load);
  await load();
}
