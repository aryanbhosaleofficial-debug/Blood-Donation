/**
 * frontend/modules/hospital/request-detail.page
 *
 * Summary + timestamps + note + cancel/complete actions for one owned request.
 * Module 03 shows no bank allocations, donor pledges, or ETA (those modules do
 * not exist yet).
 */

import { ApiError } from '../../core/api-client.js';
import { hospitalService, getSelectedRequestId } from './hospital.service.js';
import { field, statusBadge, formatTime } from './components/request-status.js';
import { hospitalAllocationList } from './components/allocation-list.js';

export async function renderRequestDetail(outlet, ctx) {
  const navigate = (ctx && ctx.navigate) || (() => {});
  const id = getSelectedRequestId();

  const h = document.createElement('h2');
  h.textContent = id ? `Request #${id}` : 'Request';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const body = document.createElement('div');
  body.className = 'card';
  outlet.append(h, status, body);

  if (!id) {
    status.textContent = 'No request selected.';
    return;
  }

  async function load() {
    status.textContent = 'Loading…';
    body.replaceChildren();
    try {
      const [data, allocationData] = await Promise.all([hospitalService.getRequest(id), hospitalService.requestAllocations(id)]);
      const r = data.request;
      body.append(
        field('Status', statusBadge(r)),
        field('Blood group', r.bloodGroup),
        field('Component', r.component),
        field('Units needed', r.unitsNeeded),
        field('Allocated by banks', r.bankUnitsAllocated),
        field('Remaining units', r.remainingBankUnits),
        field('Urgency', r.urgency),
        field('Note', r.note),
        field('Created', formatTime(r.createdAt)),
        field('Expires', formatTime(r.expiresAt)),
        field('Closed', r.closedAt ? formatTime(r.closedAt) : '-'),
        field('Banks notified', data.broadcast ? data.broadcast.bankCount : '-'),
      );
      if (r.status === 'COVERED') {
        const covered = document.createElement('p'); covered.textContent = 'Coverage target reached. This does not indicate clinical readiness.'; body.append(covered);
      }
      body.append(hospitalAllocationList(allocationData.allocations));

      if (r.status === 'OPEN' || r.status === 'COVERED') {
        body.append(actionButton('Cancel request', () => hospitalService.cancelRequest(id), load));
      }
      if (r.status === 'COVERED') {
        body.append(actionButton('Mark completed', () => hospitalService.completeRequest(id), load));
      }
      status.textContent = '';
    } catch (err) {
      status.textContent = err instanceof ApiError ? `Could not load: ${err.message}` : 'Could not load the request.';
    }
  }

  function actionButton(label, action, after) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.addEventListener('click', async () => {
      if (label.startsWith('Cancel') && !window.confirm('Cancel this emergency request?')) return;
      btn.disabled = true;
      try {
        await action();
        await after();
      } catch (err) {
        status.textContent = err && err.message ? String(err.message) : 'Action failed.';
        btn.disabled = false;
      }
    });
    return btn;
  }

  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = 'Back to my requests';
  back.addEventListener('click', () => navigate('/hospital/requests'));
  outlet.append(back);

  await load();
}
