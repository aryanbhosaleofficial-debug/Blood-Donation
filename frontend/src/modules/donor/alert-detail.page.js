import { ApiError } from '../../core/api-client.js';
import { donorService, getSelectedAlertId, setSelectedPledgeId } from './donor.service.js';

export async function renderDonorAlertDetail(outlet, ctx) {
  const navigate = ctx?.navigate || (() => {});
  const h = document.createElement('h2'); h.textContent = 'Potential donor alert';
  const body = document.createElement('div'); body.className = 'card'; outlet.append(h, body);
  const id = getSelectedAlertId(); if (!id) { body.textContent = 'No alert selected.'; return; }
  try {
    let alert = (await donorService.alert(id)).alert;
    if (alert.status === 'ACTIVE') alert = (await donorService.view(id)).alert;
    const values = [['Requested group',alert.request.bloodGroup],['Component','Red Cells'],['Urgency',alert.request.urgency],['Remaining bank requirement',String(alert.request.remainingRequirement)],['Hospital',alert.hospital.name],['Location',[alert.hospital.locality,alert.hospital.city].filter(Boolean).join(', ')],['Request time',new Date(alert.request.createdAt).toLocaleString()],['Expiry',new Date(alert.request.expiresAt).toLocaleString()],['Alert status',alert.status]];
    for (const [label,value] of values) { const p=document.createElement('p'); p.textContent=`${label}: ${value}`; body.append(p); }
    const safety=document.createElement('p'); safety.textContent='A pledge only indicates willingness to respond. Medical screening and final compatibility are determined by professionals.'; body.append(safety);
    if (alert.isActionable) {
      const pledge=document.createElement('button'); pledge.type='button'; pledge.textContent='Pledge to respond'; const status=document.createElement('p');
      pledge.addEventListener('click',async()=>{pledge.disabled=true;status.textContent='';try{const result=await donorService.pledge(id);setSelectedPledgeId(result.pledge.id);navigate('/donor/pledge-detail');}catch(err){status.textContent=err instanceof ApiError&&err.code==='SLOTS_FULL'?'Enough potential donors have already responded to this request.':err.message;pledge.disabled=false;}});
      body.append(pledge,status);
    }
  } catch (err) { body.textContent=err.message; }
}
