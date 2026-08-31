'use strict';

/**
 * integrations/gemini/gemini.mock
 *
 * Deterministic in-memory Gemini adapter for tests. Records every prompt so a
 * test can assert what was (and was not) sent. Never touches the network.
 *
 *   const mock = createGeminiMock();
 *   geminiService.setClient(mock);
 *   ... run code ...
 *   mock.calls[0].prompt   // inspect
 *   mock.reset();
 */

const { GeminiTimeoutError, GeminiRateLimitError, GeminiProviderError, GeminiInvalidResponseError } =
  require('./gemini.errors');

function createGeminiMock(options = {}) {
  const calls = [];
  let mode = options.mode || 'ok'; // 'ok' | 'timeout' | 'rate_limit' | 'provider_error' | 'malformed'
  let nextText = options.text || 'Aggregate demand is steady. Open requests are within the usual range. Two banks are low on O-negative stock and may need attention. No unusual concentration is visible.';

  return {
    calls,
    reset() {
      calls.length = 0;
      mode = options.mode || 'ok';
    },
    setMode(next) {
      mode = next;
    },
    setText(next) {
      nextText = next;
    },
    async generateText({ prompt, systemInstruction } = {}) {
      calls.push({ prompt, systemInstruction, at: Date.now() });
      switch (mode) {
        case 'timeout':
          throw new GeminiTimeoutError(15000);
        case 'rate_limit':
          throw new GeminiRateLimitError();
        case 'provider_error':
          throw new GeminiProviderError(503);
        case 'malformed':
          throw new GeminiInvalidResponseError('no text in response');
        default:
          return { text: nextText, usage: { promptTokenCount: 42, candidatesTokenCount: 60 }, model: 'mock-model' };
      }
    },
  };
}

module.exports = { createGeminiMock };
