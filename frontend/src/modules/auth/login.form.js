/**
 * frontend/modules/auth/login.form
 *
 * Builds the login form DOM. All dynamic text uses textContent (never
 * innerHTML) so injected values can never execute as markup.
 */

export function createLoginForm({ onSubmit }) {
  const form = document.createElement('form');
  form.className = 'login-form';
  form.noValidate = true;

  const title = document.createElement('h2');
  title.textContent = 'Sign in';

  const emailLabel = document.createElement('label');
  emailLabel.textContent = 'Email';
  const emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.name = 'email';
  emailInput.autocomplete = 'username';
  emailInput.required = true;
  emailLabel.append(emailInput);

  const passwordLabel = document.createElement('label');
  passwordLabel.textContent = 'Password';
  const passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.name = 'password';
  passwordInput.autocomplete = 'current-password';
  passwordInput.required = true;
  passwordLabel.append(passwordInput);

  const error = document.createElement('p');
  error.className = 'form-error';
  error.hidden = true;
  error.setAttribute('role', 'alert');

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = 'Sign in';

  form.append(title, emailLabel, passwordLabel, error, submit);

  function setError(message) {
    if (!message) {
      error.hidden = true;
      error.textContent = '';
      return;
    }
    error.textContent = message; // textContent: safe against XSS
    error.hidden = false;
  }

  function setBusy(busy) {
    submit.disabled = busy;
    emailInput.disabled = busy;
    passwordInput.disabled = busy;
    submit.textContent = busy ? 'Signing in…' : 'Sign in';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSubmit({ email: emailInput.value, password: passwordInput.value });
    } catch (err) {
      // Generic message: do not echo server text that might reveal specifics.
      setError('Invalid email or password.');
      passwordInput.value = '';
    } finally {
      setBusy(false);
    }
  });

  return { element: form, setError, setBusy };
}
