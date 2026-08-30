import { donorService, getSelectedPledgeId } from './donor.service.js';
import { pledgeControl } from './components/pledge-control.js';
import { locationSharing } from './components/location-sharing.js';

export async function renderDonorPledgeDetail(outlet) {
  const h = document.createElement('h2'); h.textContent = 'Potential donor pledge';
  const body = document.createElement('div'); outlet.append(h, body);
  const id = getSelectedPledgeId(); if (!id) { body.textContent = 'No pledge selected.'; return; }
  async function load() {
    body.replaceChildren();
    try {
      const pledge = (await donorService.pledgeDetail(id)).pledge;
      const card = document.createElement('section'); card.className = 'card';
      for (const [label, value] of [['Reference',pledge.publicReference],['Hospital',pledge.hospital.name],['Location',[pledge.hospital.locality,pledge.hospital.city].filter(Boolean).join(', ')],['Requested blood group',pledge.request.bloodGroup],['Urgency',pledge.request.urgency],['Pledge status',pledge.status],['Pledged at',new Date(pledge.pledgedAt).toLocaleString()]]) { const p=document.createElement('p'); p.textContent=`${label}: ${value}`; card.append(p); }
      card.append(pledgeControl(pledge,{cancel:async()=>{await donorService.cancelPledge(id);await load();},arrive:async()=>{await donorService.arrive(id);await load();}})); body.append(card);
      if (['PLEDGED','ARRIVED'].includes(pledge.status)) body.append(locationSharing(pledge,{start:async coords=>{await donorService.shareLocation(id,coords);await load();},stop:async()=>{await donorService.stopLocation(id);await load();}}));
    } catch (err) { body.textContent = err.message; }
  }
  await load();
}
