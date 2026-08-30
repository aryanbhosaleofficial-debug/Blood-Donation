import { donorService, setSelectedPledgeId } from './donor.service.js';

export async function renderDonorPledges(outlet, ctx) {
  const h=document.createElement('h2');h.textContent='My potential donor pledges';const body=document.createElement('div');outlet.append(h,body);
  try { const data=await donorService.pledges(); if(!data.pledges.length){body.textContent='No pledges.';return;} for(const pledge of data.pledges){const card=document.createElement('article');card.className='request-card';const title=document.createElement('strong');title.textContent=`${pledge.publicReference} · ${pledge.status}`;const detail=document.createElement('p');detail.textContent=`${pledge.request.bloodGroup} Red Cells · ${pledge.hospital.name}`;const open=document.createElement('button');open.type='button';open.textContent='View';open.addEventListener('click',()=>{setSelectedPledgeId(pledge.id);ctx?.navigate?.('/donor/pledge-detail');});card.append(title,detail,open);body.append(card);}}
  catch(err){body.textContent=err.message;}
}
