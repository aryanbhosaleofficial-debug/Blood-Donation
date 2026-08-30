'use strict';

/**
 * Minimal cookie-aware HTTP client for integration tests (no supertest).
 *
 *   const client = createClient(baseUrl);
 *   const res = await client.post('/api/auth/login', { email, password },
 *                                 { headers: { Origin: 'http://localhost:3000' } });
 *   res.status; res.json; res.setCookies;
 *
 * Cookies from Set-Cookie are stored and replayed on subsequent requests.
 */

function parseSetCookie(header) {
  // "name=value; Path=/; HttpOnly" -> { name, value }
  const firstPair = header.split(';')[0];
  const eq = firstPair.indexOf('=');
  if (eq === -1) return null;
  return { name: firstPair.slice(0, eq).trim(), value: firstPair.slice(eq + 1).trim() };
}

function createClient(baseUrl) {
  const jar = new Map();

  function cookieHeader() {
    return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  async function request(pathname, { method = 'GET', body, headers = {} } = {}) {
    const finalHeaders = { Accept: 'application/json', ...headers };
    if (jar.size > 0) {
      finalHeaders.Cookie = cookieHeader();
    }
    let payload;
    if (body !== undefined) {
      finalHeaders['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    const res = await fetch(baseUrl + pathname, { method, headers: finalHeaders, body: payload });

    const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    for (const raw of setCookies) {
      const parsed = parseSetCookie(raw);
      if (!parsed) continue;
      if (parsed.value === '' || /expires=thu, 01 jan 1970/i.test(raw)) {
        jar.delete(parsed.name);
      } else {
        jar.set(parsed.name, parsed.value);
      }
    }

    const text = await res.text();
    let json = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }

    return { status: res.status, headers: res.headers, json, text, setCookies, rawResponse: res };
  }

  return {
    request,
    get: (p, o) => request(p, { ...o, method: 'GET' }),
    post: (p, body, o) => request(p, { ...o, method: 'POST', body }),
    patch: (p, body, o) => request(p, { ...o, method: 'PATCH', body }),
    del: (p, o) => request(p, { ...o, method: 'DELETE' }),
    cookies: () => new Map(jar),
    cookie: (name) => jar.get(name),
  };
}

module.exports = { createClient, parseSetCookie };
