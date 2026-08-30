/**
 * frontend/modules/auth/login.page
 *
 * Renders the login view into an outlet element.
 */

import { createLoginForm } from './login.form.js';
import { login } from './auth.service.js';

/**
 * @param {HTMLElement} outlet
 * @param {{ onSuccess?: () => void }} [options]
 */
export function renderLoginPage(outlet, { onSuccess } = {}) {
  const section = document.createElement('section');
  section.className = 'login';

  const { element } = createLoginForm({
    onSubmit: async ({ email, password }) => {
      await login(email, password);
      if (typeof onSuccess === 'function') {
        onSuccess();
      }
    },
  });

  section.append(element);
  outlet.append(section);
}
