/**
 * frontend entry point (Module 01).
 *
 * - loads the server session (GET /api/auth/me)
 * - bootstraps a CSRF token when authenticated
 * - routes between a login view and a minimal authenticated placeholder
 *
 * All dynamic values are rendered with textContent (never innerHTML).
 */

import { apiClient, ApiError } from './core/api-client.js';
import { load as loadSession, getUser, isAuthenticated } from './core/session.js';
import { fetchCsrfToken } from './core/csrf.js';
import { createRouter } from './core/router.js';
import { renderLoginPage } from './modules/auth/login.page.js';
import { logout } from './modules/auth/auth.service.js';
import { renderHospitalProfile } from './modules/hospital/profile.page.js';
import { renderHospitalDashboard } from './modules/hospital/dashboard.page.js';
import { renderCreateRequest } from './modules/hospital/create-request.page.js';
import { renderRequestHistory } from './modules/hospital/request-history.page.js';
import { renderRequestDetail } from './modules/hospital/request-detail.page.js';
import { renderBankProfile } from './modules/bank/profile.page.js';
import { renderInventory } from './modules/bank/inventory.page.js';
import { renderIncomingRequests } from './modules/bank/incoming-requests.page.js';
import { renderBankRequestDetail } from './modules/bank/request-detail.page.js';
import { renderAdminVerification } from './modules/admin/verification.page.js';

function row(label, value) {
  const el = document.createElement('div');
  el.className = 'row';
  const k = document.createElement('span');
  k.className = 'k';
  k.textContent = label;
  const v = document.createElement('span');
  v.className = 'v';
  v.textContent = value;
  el.append(k, v);
  return el;
}

function renderBadge() {
  const badge = document.getElementById('session-badge');
  if (!badge) return;
  const user = getUser();
  badge.textContent = user ? `Signed in as ${user.email} (${user.role})` : 'Not signed in';
}

function renderNav(navigate) {
  const nav=document.getElementById('role-nav'); nav.replaceChildren(); const user=getUser(); if(!user)return;
  const links=user.role==='HOSPITAL'?[['Dashboard','/hospital/dashboard'],['Profile','/hospital/profile'],['Create Request','/hospital/create-request'],['My Requests','/hospital/requests']]:user.role==='BLOOD_BANK'?[['Profile','/bank/profile'],['Inventory','/bank/inventory'],['Incoming Requests','/bank/incoming-requests']]:user.role==='ADMIN'?[['Organization Verification','/admin/organizations']]:[['Home','/']];
  for(const [label,path] of links){const a=document.createElement('a');a.href=`#${path}`;a.textContent=label;a.addEventListener('click',e=>{e.preventDefault();navigate(path);});nav.append(a);}
}

function healthView(outlet) {
  const section = document.createElement('section');
  const h = document.createElement('h2');
  h.textContent = 'System Status';
  const card = document.createElement('div');
  card.className = 'card';
  card.textContent = 'Checking backend health…';
  section.append(h, card);
  outlet.append(section);

  apiClient
    .get('/health')
    .then((data) => {
      card.textContent = '';
      card.append(
        row('Backend', data.status ?? 'unknown'),
        row('Database', data.db ?? 'unknown'),
        row('Schema version', String(data.schemaVersion ?? '—')),
      );
    })
    .catch((err) => {
      card.textContent = err instanceof ApiError ? `Health check failed: ${err.message}` : 'Health check failed.';
      card.classList.add('error');
    });
}

function homeView(outlet, navigate) {
  if (!isAuthenticated()) {
    const p = document.createElement('p');
    p.textContent = 'You are not signed in.';
    const link = document.createElement('button');
    link.type = 'button';
    link.textContent = 'Go to sign in';
    link.addEventListener('click', () => navigate('/login'));
    outlet.append(p, link);
    healthView(outlet);
    return;
  }

  const user = getUser();
  const section = document.createElement('section');
  const h = document.createElement('h2');
  h.textContent = 'Signed in';
  const card = document.createElement('div');
  card.className = 'card';
  card.append(row('Email', user.email), row('Role', user.role), row('Verified', user.isVerified ? 'yes' : 'no'));

  const logoutBtn = document.createElement('button');
  logoutBtn.type = 'button';
  logoutBtn.textContent = 'Sign out';
  logoutBtn.addEventListener('click', async () => {
    logoutBtn.disabled = true;
    await logout();
    renderBadge();
    renderNav(navigate);
    navigate('/login');
  });

  section.append(h, card, logoutBtn);
  outlet.append(section);
  healthView(outlet);
}

function notFoundView(outlet) {
  const p = document.createElement('p');
  p.textContent = 'Page not found.';
  outlet.append(p);
}

async function boot() {
  const outlet = document.getElementById('app');

  await loadSession();
  if (isAuthenticated()) {
    try {
      await fetchCsrfToken();
    } catch {
      /* refetched on demand */
    }
  }
  renderBadge();

  const router = createRouter({
    outlet,
    routes: {
      '/': (el) => homeView(el, (p) => router.navigate(p)),
      '/login': (el) =>
        renderLoginPage(el, {
          onSuccess: async () => {
            renderBadge();
            renderNav((p) => router.navigate(p));
            router.navigate('/');
          },
        }),
      '/hospital/profile': renderHospitalProfile,
      '/hospital/dashboard': (el) => renderHospitalDashboard(el, { navigate: (p) => router.navigate(p) }),
      '/hospital/create-request': (el) => renderCreateRequest(el, { navigate: (p) => router.navigate(p) }),
      '/hospital/requests': (el) => renderRequestHistory(el, { navigate: (p) => router.navigate(p) }),
      '/hospital/request-detail': (el) => renderRequestDetail(el, { navigate: (p) => router.navigate(p) }),
      '/bank/profile': renderBankProfile,
      '/bank/inventory': renderInventory,
      '/bank/incoming-requests': (el) => renderIncomingRequests(el, { navigate: (p) => router.navigate(p) }),
      '/bank/request-detail': (el) => renderBankRequestDetail(el, { navigate: (p) => router.navigate(p) }),
      '/admin/organizations': renderAdminVerification,
    },
    fallback: notFoundView,
  });

  router.start();
  renderNav((p)=>router.navigate(p));

  if (!isAuthenticated() && router.currentPath() !== '/login') {
    router.navigate('/login');
  }
}

boot();
