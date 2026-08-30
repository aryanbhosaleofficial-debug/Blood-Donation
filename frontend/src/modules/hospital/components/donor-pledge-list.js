export function donorPledgeList(data) {
  const section=document.createElement('section');section.className='card';const h=document.createElement('h3');h.textContent='Potential donor responses';section.append(h);
  const summary=document.createElement('p');summary.textContent=`Active responses: ${data.activePotentialDonorPledges} · coordination slots: ${data.maxPledgeSlots} · available: ${data.availablePledgeSlots}`;section.append(summary);
  for(const pledge of data.pledges){const card=document.createElement('article');card.className='request-card';const title=document.createElement('strong');title.textContent=`Potential Donor ${pledge.publicReference}`;const status=document.createElement('p');status.textContent=`Status: ${pledge.status}`;const eta=document.createElement('p');eta.textContent=`Potential donor ETA: ${pledge.etaBand||'unavailable'}`;const distance=document.createElement('p');distance.textContent=`Distance: ${pledge.distanceBand||'unavailable'}`;card.append(title,status,eta,distance);section.append(card);}
  const disclaimer=document.createElement('p');disclaimer.textContent=data.disclaimer;section.append(disclaimer);return section;
}
