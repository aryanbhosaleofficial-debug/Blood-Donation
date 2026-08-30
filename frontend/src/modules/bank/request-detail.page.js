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

  async function load() {
    status.textContent='Loading…'; body.replaceChildren();
  try {
    const [data, inventoryData] = await Promise.all([bankService.incomingRequest(id), bankService.inventory()]);
    const r = data.request;
    const hosp = r.hospital || {};
    const matching = inventoryData.inventory.find((item)=>item.bloodGroup===r.bloodGroup&&item.component===r.component);
    body.append(
      field('Blood group', r.bloodGroup),
      field('Component', r.component),
      field('Units needed', r.unitsNeeded),
      field('Currently allocated', r.bankUnitsAllocated),
      field('Remaining units', r.remainingBankUnits),
      field('Matching stock', matching ? matching.unitsAvailable : 'Not configured'),
      field('Urgency', r.urgency),
      field('Status', r.status),
      field('Hospital', hosp.name),
      field('Location', [hosp.locality, hosp.city].filter(Boolean).join(', ')),
      field('Created', formatTime(r.createdAt)),
      field('Expires', formatTime(r.expiresAt)),
    );
    if(r.ownAllocation){body.append(field('My allocation',r.ownAllocation.status));}
    else if(r.status==='OPEN'&&r.remainingBankUnits>0){const reserve=document.createElement('button');reserve.type='button';reserve.textContent='Reserve maximum safe quantity';reserve.addEventListener('click',async()=>{reserve.disabled=true;status.textContent='Reserving…';try{await bankService.allocate(id);await load();}catch(e){const known=['ALREADY_COVERED','NO_STOCK','BANK_ALREADY_ALLOCATED','REQUEST_NOT_OPEN'];status.textContent=e instanceof ApiError&&known.includes(e.code)?e.message:'Could not reserve this request.';reserve.disabled=false;}});body.append(reserve);}
    status.textContent = '';
  } catch (err) {
    status.textContent = err instanceof ApiError ? `Could not load: ${err.message}` : 'Could not load the request.';
  }
  }
  await load();
}
