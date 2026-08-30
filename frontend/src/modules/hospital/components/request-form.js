/**
 * frontend/modules/hospital/components/request-form
 *
 * Emergency request form. Component is fixed to RED_CELLS.
 *
 * Idempotency: one clientRequestId is generated per submission attempt and
 * REUSED across network retries of that same attempt. A new id is only minted
 * after a success or an explicit reset - never per retry.
 */

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const URGENCIES = ['NORMAL', 'URGENT', 'CRITICAL'];

function selectField(label, name, options) {
  const wrap = document.createElement('label');
  wrap.textContent = label;
  const select = document.createElement('select');
  select.name = name;
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    select.append(o);
  }
  wrap.append(select);
  return { wrap, select };
}

export function requestForm({ onSubmit }) {
  const form = document.createElement('form');
  form.className = 'form-grid request-form';
  form.noValidate = true;

  const group = selectField('Blood group', 'bloodGroup', BLOOD_GROUPS);
  const urgency = selectField('Urgency', 'urgency', URGENCIES);

  const unitsWrap = document.createElement('label');
  unitsWrap.textContent = 'Units needed';
  const units = document.createElement('input');
  units.type = 'number';
  units.name = 'unitsNeeded';
  units.min = '1';
  units.step = '1';
  units.value = '1';
  unitsWrap.append(units);

  const componentWrap = document.createElement('label');
  componentWrap.textContent = 'Component';
  const component = document.createElement('input');
  component.value = 'RED_CELLS';
  component.readOnly = true;
  component.name = 'component';
  componentWrap.append(component);

  const noteWrap = document.createElement('label');
  noteWrap.textContent = 'Note (optional)';
  const note = document.createElement('textarea');
  note.name = 'note';
  note.maxLength = 500;
  noteWrap.append(note);

  const error = document.createElement('p');
  error.className = 'form-error';
  error.hidden = true;
  error.setAttribute('role', 'alert');

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = 'Post emergency request';

  form.append(group.wrap, urgency.wrap, unitsWrap, componentWrap, noteWrap, error, submit);

  let clientRequestId = crypto.randomUUID();

  function setError(message) {
    error.textContent = message || '';
    error.hidden = !message;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setError(null);
    submit.disabled = true; // double-submit guard (backend idempotency is authoritative)
    submit.textContent = 'Posting…';
    try {
      const payload = {
        clientRequestId,
        bloodGroup: group.select.value,
        component: 'RED_CELLS',
        unitsNeeded: Number(units.value),
        urgency: urgency.select.value,
      };
      const trimmedNote = note.value.trim();
      if (trimmedNote) payload.note = trimmedNote;

      await onSubmit(payload);
      clientRequestId = crypto.randomUUID(); // next logical submission gets a new id
      form.reset();
      component.value = 'RED_CELLS';
    } catch (err) {
      setError(err && err.message ? String(err.message) : 'Could not post the request.');
    } finally {
      submit.disabled = false;
      submit.textContent = 'Post emergency request';
    }
  });

  return { element: form };
}
