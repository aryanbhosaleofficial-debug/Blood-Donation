/**
 * frontend/modules/hospital/dashboard.page
 *
 * A small landing page linking the hospital's Module 03 actions.
 */

import { ApiError } from '../../core/api-client.js';
import { hospitalService } from './hospital.service.js';

export async function renderHospitalDashboard(outlet, ctx) {
  const navigate = (ctx && ctx.navigate) || (() => {});

  const h = document.createElement('h2');
  h.textContent = 'Hospital dashboard';
  const status = document.createElement('p');
  outlet.append(h, status);

  try {
    const profile = await hospitalService.get();
    status.textContent = profile.isVerified
      ? `${profile.name} - verified`
      : `${profile.name} - pending verification (you cannot post requests yet)`;
  } catch (err) {
    status.textContent =
      err instanceof ApiError && err.status === 404
        ? 'Create your hospital profile first.'
        : 'Could not load your profile.';
  }

  const actions = [
    ['Create emergency request', '/hospital/create-request'],
    ['My requests', '/hospital/requests'],
    ['Hospital profile', '/hospital/profile'],
  ];
  for (const [label, path] of actions) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', () => navigate(path));
    outlet.append(b);
  }
}
