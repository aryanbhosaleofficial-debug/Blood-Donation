'use strict';

/**
 * integrations/gemini/gemini.client
 *
 * Thin wrapper around @google/genai. Responsibilities:
 *   - lazy-load the SDK (never required unless a call actually happens)
 *   - enforce the disabled-mode guard
 *   - enforce a hard timeout (AbortSignal.timeout)
 *   - translate transport / HTTP failures into typed GeminiError subclasses
 *   - return ONLY { text, usage } — never the raw SDK response
 *
 * The API key comes from core/config (the only env reader). It is passed to
 * the SDK constructor and never logged, never returned, never thrown in a
 * message.
 */

const config = require('./gemini.config');
const {
  GeminiDisabledError,
  GeminiTimeoutError,
  GeminiRateLimitError,
  GeminiProviderError,
  GeminiInvalidResponseError,
} = require('./gemini.errors');

let cachedSdk = null;

function loadSdk() {
  if (!cachedSdk) {
    // eslint-disable-next-line global-require
    cachedSdk = require('@google/genai');
  }
  return cachedSdk;
}

/**
 * Generate text from a fully-prepared prompt string.
 *
 * @param {object} params
 * @param {string} params.prompt         — the complete prompt (already de-identified)
 * @param {string} [params.systemInstruction]
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<{ text: string, usage: object, model: string }>}
 */
async function generateText({ prompt, systemInstruction, signal } = {}) {
  if (!config.enabled) throw new GeminiDisabledError();
  if (!config.apiKey) throw new GeminiDisabledError();
  if (typeof prompt !== 'string' || prompt.trim() === '') {
    throw new GeminiInvalidResponseError('empty prompt');
  }

  const { GoogleGenAI } = loadSdk();
  const ai = new GoogleGenAI({ apiKey: config.apiKey });

  const timeoutSignal = AbortSignal.timeout(config.timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

  let response;
  try {
    response = await ai.models.generateContent({
      model: config.model,
      contents: prompt,
      config: {
        maxOutputTokens: config.maxOutputTokens,
        temperature: 0.2,
        ...(systemInstruction ? { systemInstruction } : {}),
        abortSignal: combined,
      },
    });
  } catch (err) {
    if (err && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new GeminiTimeoutError(config.timeoutMs);
    }
    const status = err && (err.status || err.code || (err.response && err.response.status));
    if (status === 429) throw new GeminiRateLimitError();
    if (typeof status === 'number' && status >= 400) throw new GeminiProviderError(status);
    throw new GeminiProviderError(err && err.message ? 502 : 502);
  }

  const text =
    (response && typeof response.text === 'string' && response.text) ||
    (response && typeof response.text === 'function' && response.text()) ||
    '';
  if (!text || !String(text).trim()) {
    throw new GeminiInvalidResponseError('no text in response');
  }

  return {
    text: String(text).trim(),
    usage: (response && response.usageMetadata) || {},
    model: config.model,
  };
}

module.exports = { generateText, _loadSdk: loadSdk };
