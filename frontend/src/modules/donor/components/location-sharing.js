export function locationSharing(pledge, actions) {
  const section = document.createElement('section'); section.className = 'card';
  const heading = document.createElement('h3'); heading.textContent = 'Temporary location sharing';
  const explanation = document.createElement('p');
  explanation.textContent = 'Your current location is used temporarily to estimate travel time for this request. Exact coordinates are not shown to the hospital.';
  const indicator = document.createElement('p');
  indicator.textContent = pledge.locationSharing.isActive ? `Location sharing active until ${new Date(pledge.locationSharing.expiresAt).toLocaleString()}` : 'Location sharing is off.';
  const action = document.createElement('button'); action.type = 'button';
  action.textContent = pledge.locationSharing.isActive ? 'Stop Location Sharing' : 'Start Location Sharing';
  action.addEventListener('click', async () => {
    action.disabled = true;
    try {
      if (pledge.locationSharing.isActive) { await actions.stop(); return; }
      if (!window.isSecureContext) throw new Error('Location sharing requires HTTPS or localhost.');
      if (!navigator.geolocation) throw new Error('Geolocation is unavailable in this browser.');
      const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, maximumAge: 30000, timeout: 15000 }));
      await actions.start({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch (err) { indicator.textContent = `Location sharing remains off: ${err.message}`; action.disabled = false; }
  });
  section.append(heading, explanation, indicator, action);
  return section;
}
