export function pledgeControl(pledge, actions) {
  const section = document.createElement('section');
  const status = document.createElement('p');
  if (pledge.status === 'PLEDGED') {
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel pledge';
    cancel.addEventListener('click', async () => { cancel.disabled = true; try { await actions.cancel(); } catch (err) { status.textContent = err.message; cancel.disabled = false; } });
    const arrive = document.createElement('button'); arrive.type = 'button'; arrive.textContent = 'Mark arrived';
    arrive.addEventListener('click', async () => { arrive.disabled = true; try { await actions.arrive(); } catch (err) { status.textContent = err.message; arrive.disabled = false; } });
    section.append(cancel, arrive);
  }
  const note = document.createElement('p');
  note.textContent = '“Arrived” means you reported reaching the facility. It does not mean donation, acceptance, testing, or clinical readiness.';
  section.append(status, note);
  return section;
}
