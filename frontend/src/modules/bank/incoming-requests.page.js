/**
 * frontend/modules/bank/incoming-requests.page
 *
 * Polls GET /api/blood-bank/requests every POLL_INTERVAL_MS (default 3s).
 * Handles loading / success / temporary failure / retry. Polling is best-effort,
 * not guaranteed real-time. Read-only - no allocation actions in Module 03.
 */

import { ApiError } from '../../core/api-client.js';
import { bankService, setSelectedRequestId } from './bank.service.js';
import { incomingRequestCard } from './components/incoming-request-card.js';

const POLL_MS = 3000;

export async function renderIncomingRequests(outlet, ctx) {
  const navigate = (ctx && ctx.navigate) || (() => {});

  const h = document.createElement('h2');
  h.textContent = 'Incoming emergency requests';
  const note = document.createElement('p');
  note.className = 'app-footer';
  note.textContent = 'Updates by polling (~3s). Not guaranteed real-time. Viewing only in this version.';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const listEl = document.createElement('div');
  listEl.className = 'request-list';
  outlet.append(h, note, status, listEl);

  let timer = null;
  let stopped = false;
  let failures = 0;

  async function tick() {
    // The router just swaps outlet contents; stop once this view is detached.
    if (!status.isConnected) {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      return;
    }
    try {
      const data = await bankService.incomingRequests();
      failures = 0;
      status.textContent = data.requests.length ? '' : 'No open requests broadcast to you right now.';
      listEl.replaceChildren();
      for (const request of data.requests) {
        listEl.append(
          incomingRequestCard(request, {
            onOpen: (id) => {
              setSelectedRequestId(id);
              navigate('/bank/request-detail');
            },
          }),
        );
      }
    } catch (err) {
      failures += 1;
      const message = err instanceof ApiError ? err.message : 'Connection problem';
      status.textContent = `Could not refresh (${message}). Retrying…`;
      if (err instanceof ApiError && err.status === 403) {
        stop();
        status.textContent = 'Your organization is no longer verified. Polling stopped.';
        return;
      }
    }
    if (!stopped) {
      const delay = Math.min(POLL_MS * Math.max(1, failures), 15000);
      timer = window.setTimeout(tick, delay);
    }
  }

  function stop() {
    stopped = true;
    if (timer) window.clearTimeout(timer);
  }

  // Pause polling while the tab is hidden.
  const onVisibility = () => {
    if (document.hidden) {
      stop();
    } else if (stopped) {
      stopped = false;
      tick();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  status.textContent = 'Loading…';
  await tick();
}
