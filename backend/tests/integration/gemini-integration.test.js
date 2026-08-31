'use strict';

/**
 * Gemini integration — behaviour, privacy, and safe-logging tests.
 * All mocked. No network. The core system must be unaffected by Gemini state.
 */

require('../helpers/env');

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildConfig } = require('../../src/core/config');
const { assertNoForbiddenKeys, pickAllowed } = require('../../src/integrations/gemini/gemini.sanitizer');
const { GeminiPrivacyError } = require('../../src/integrations/gemini/gemini.errors');
const { OPS_SUMMARY_ALLOWED_KEYS } = require('../../src/integrations/gemini/gemini.constants');
const geminiService = require('../../src/integrations/gemini/gemini.service');
const { createGeminiMock } = require('../../src/integrations/gemini/gemini.mock');

const BASE_ENV = {
  NODE_ENV: 'test',
  SESSION_SECRET: 'test-session-secret-abcdefghijklmnop',
  APP_ORIGIN: 'http://localhost:3000',
};

test('config: GEMINI defaults are safe (disabled, not configured)', () => {
  const cfg = buildConfig({ ...BASE_ENV });
  assert.equal(cfg.gemini.enabled, false);
  assert.equal(cfg.gemini.apiKey, '');
  assert.ok(cfg.gemini.model.length > 0, 'a model name is always present');
  assert.equal(cfg.gemini.timeoutMs, 15000);
});

test('config: GEMINI_ENABLED=true without a key is a hard config error', () => {
  assert.throws(
    () => buildConfig({ ...BASE_ENV, GEMINI_ENABLED: 'true' }),
    /GEMINI_ENABLED=true requires GEMINI_API_KEY/,
  );
});

test('config: DB_PROVIDER=supabase requires url + service role key', () => {
  assert.throws(
    () => buildConfig({ ...BASE_ENV, DB_PROVIDER: 'supabase' }),
    /SUPABASE_URL[\s\S]*SUPABASE_SERVICE_ROLE_KEY|SUPABASE_URL/,
  );
});

test('sanitizer: rejects forbidden keys anywhere in the graph', () => {
  assert.throws(() => assertNoForbiddenKeys({ a: { b: { phone_private: '123' } } }), GeminiPrivacyError);
  assert.throws(() => assertNoForbiddenKeys({ list: [{ latitude: 1 }] }), GeminiPrivacyError);
  assert.throws(() => assertNoForbiddenKeys({ password_hash: 'x' }), GeminiPrivacyError);
  assert.throws(() => assertNoForbiddenKeys({ csrfToken: 'x' }), GeminiPrivacyError);
  assert.doesNotThrow(() => assertNoForbiddenKeys({ openRequests: 5, byCity: { Pune: 2 } }));
});

test('sanitizer: pickAllowed keeps only allow-listed keys', () => {
  const out = pickAllowed(
    { openRequests: 3, phone_private: '999', secretStuff: 1, byBloodGroup: { 'O-': 2 } },
    OPS_SUMMARY_ALLOWED_KEYS,
  );
  assert.deepEqual(out, { openRequests: 3, byBloodGroup: { 'O-': 2 } });
});

test('service: disabled -> available:false, no client call', async () => {
  const mock = createGeminiMock();
  geminiService.setClient(mock);
  // gemini.config reads the live singleton (disabled in tests) -> disabled path
  const res = await geminiService.summarizeOperations({ openRequests: 2 });
  assert.equal(res.available, false);
  assert.equal(res.reason, 'GEMINI_DISABLED');
  assert.equal(mock.calls.length, 0);
  geminiService.setClient(null);
});

// The remaining service tests force-enable via a patched gemini.config module.
function withEnabledGemini(fn) {
  const cfgModule = require('../../src/integrations/gemini/gemini.config');
  cfgModule.__setOverride({ enabled: true, apiKey: 'test-key-not-real' });
  return Promise.resolve()
    .then(fn)
    .finally(() => cfgModule.__setOverride(null));
}

test('service: success path returns summary + never leaks forbidden data in prompt', async () => {
  await withEnabledGemini(async () => {
    const mock = createGeminiMock({ text: 'Steady demand. Two banks low on O-negative.' });
    geminiService.setClient(mock);
    const res = await geminiService.summarizeOperations({
      openRequests: 4,
      criticalRequests: 1,
      byBloodGroup: { 'O-': 3 },
      // these must be stripped before the prompt is built:
      phone_private: '+910000000000',
      latitude: 18.52,
      password_hash: 'abc',
      admin_note: 'secret note',
    });
    assert.equal(res.available, true);
    assert.match(res.summary, /Steady demand/);
    assert.equal(mock.calls.length, 1);
    const prompt = mock.calls[0].prompt;
    for (const needle of ['+910000000000', '18.52', 'abc', 'secret note', 'phone_private', 'latitude', 'password_hash', 'admin_note']) {
      assert.ok(!prompt.includes(needle), `prompt must not contain "${needle}"`);
    }
    assert.ok(prompt.includes('openRequests'), 'allow-listed keys are present');
    geminiService.setClient(null);
  });
});

for (const [mode, reason] of [
  ['timeout', 'GEMINI_TIMEOUT'],
  ['rate_limit', 'GEMINI_RATE_LIMITED'],
  ['provider_error', 'GEMINI_PROVIDER_ERROR'],
  ['malformed', 'GEMINI_INVALID_RESPONSE'],
]) {
  test(`service: ${mode} failure is non-fatal -> available:false (${reason})`, async () => {
    await withEnabledGemini(async () => {
      const mock = createGeminiMock({ mode });
      geminiService.setClient(mock);
      const res = await geminiService.summarizeOperations({ openRequests: 1 });
      assert.equal(res.available, false);
      assert.equal(res.reason, reason);
      geminiService.setClient(null);
    });
  });
}

test('service: safe logging never records the api key or raw prompt', async () => {
  await withEnabledGemini(async () => {
    const writes = [];
    const origOut = process.stdout.write;
    const origErr = process.stderr.write;
    process.stdout.write = (s) => (writes.push(String(s)), true);
    process.stderr.write = (s) => (writes.push(String(s)), true);
    process.env.LOG_LEVEL = 'debug';
    try {
      const mock = createGeminiMock();
      geminiService.setClient(mock);
      await geminiService.summarizeOperations({ openRequests: 9 }, { correlationId: 'corr-1' });
    } finally {
      process.stdout.write = origOut;
      process.stderr.write = origErr;
      process.env.LOG_LEVEL = 'silent';
      geminiService.setClient(null);
    }
    const blob = writes.join('');
    assert.ok(!/AIza|api[_-]?key|GEMINI_API_KEY/i.test(blob), 'no api key material in logs');
    assert.ok(!/Write the summary now/.test(blob), 'raw prompt body is not logged');
  });
});
