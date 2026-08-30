/**
 * frontend/modules/hospital/create-request.page
 */

import { hospitalService, setSelectedRequestId } from './hospital.service.js';
import { requestForm } from './components/request-form.js';

export async function renderCreateRequest(outlet, ctx) {
  const navigate = (ctx && ctx.navigate) || (() => {});

  const h = document.createElement('h2');
  h.textContent = 'Create emergency request';

  const disclaimer = document.createElement('p');
  disclaimer.className = 'app-footer';
  disclaimer.textContent =
    'This posts a coordination request to verified blood banks. It is not a clinical order.';

  const result = document.createElement('p');
  result.setAttribute('role', 'status');

  const { element } = requestForm({
    onSubmit: async (payload) => {
      const data = await hospitalService.createRequest(payload);
      result.textContent = `Request #${data.request.id} posted (${data.broadcast.bankCount} bank(s) notified).`;
      setSelectedRequestId(data.request.id);
    },
  });

  outlet.append(h, disclaimer, element, result);

  const toList = document.createElement('button');
  toList.type = 'button';
  toList.textContent = 'View my requests';
  toList.addEventListener('click', () => navigate('/hospital/requests'));
  outlet.append(toList);
}
