/**
 * frontend/core/router
 *
 * Minimal hash-based view switcher. No external dependencies.
 *
 * A "view" is `(outlet: HTMLElement, context) => void` - it renders itself
 * into the provided outlet element. The router clears the outlet before each
 * render.
 *
 * Usage:
 *   const router = createRouter({
 *     outlet: document.getElementById('app'),
 *     routes: { '/': homeView, '/about': aboutView },
 *     fallback: notFoundView,
 *   });
 *   router.start();
 */

export function createRouter({ outlet, routes = {}, fallback, onNavigate }) {
  if (!outlet) {
    throw new Error('createRouter: an outlet element is required');
  }

  function currentPath() {
    const raw = window.location.hash.replace(/^#/, '');
    return raw || '/';
  }

  function render() {
    const path = currentPath();
    const view = routes[path] || fallback;
    outlet.replaceChildren();
    if (typeof onNavigate === 'function') {
      onNavigate(path);
    }
    if (typeof view === 'function') {
      view(outlet, { path });
    } else {
      const p = document.createElement('p');
      p.textContent = `No view registered for "${path}".`;
      outlet.append(p);
    }
  }

  function navigate(path) {
    const next = path.startsWith('#') ? path : `#${path}`;
    if (window.location.hash === next) {
      render();
    } else {
      window.location.hash = next;
    }
  }

  function start() {
    window.addEventListener('hashchange', render);
    render();
  }

  function stop() {
    window.removeEventListener('hashchange', render);
  }

  return { start, stop, navigate, render, currentPath };
}
