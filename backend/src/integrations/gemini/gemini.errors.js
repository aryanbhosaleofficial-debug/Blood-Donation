'use strict';

/**
 * integrations/gemini/gemini.errors
 *
 * Typed, non-fatal errors for the Gemini integration. None of these should
 * ever crash Express — callers treat a Gemini failure as "no summary
 * available" and continue.
 */

class GeminiError extends Error {
  constructor(message, code = 'GEMINI_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.retryable = false;
  }
}

class GeminiDisabledError extends GeminiError {
  constructor() {
    super('Gemini integration is disabled (GEMINI_ENABLED=false).', 'GEMINI_DISABLED');
  }
}

class GeminiTimeoutError extends GeminiError {
  constructor(ms) {
    super(`Gemini request timed out after ${ms}ms.`, 'GEMINI_TIMEOUT');
    this.retryable = true;
  }
}

class GeminiRateLimitError extends GeminiError {
  constructor() {
    super('Gemini rate limit exceeded (HTTP 429).', 'GEMINI_RATE_LIMITED');
    this.retryable = true;
  }
}

class GeminiProviderError extends GeminiError {
  constructor(status) {
    super(`Gemini provider returned an error (HTTP ${status}).`, 'GEMINI_PROVIDER_ERROR');
    this.retryable = status >= 500;
  }
}

class GeminiInvalidResponseError extends GeminiError {
  constructor(detail) {
    super(`Gemini returned an unusable response: ${detail}`, 'GEMINI_INVALID_RESPONSE');
  }
}

/** Raised by the input sanitizer when a forbidden key reaches the prompt path. */
class GeminiPrivacyError extends GeminiError {
  constructor(key) {
    super(`Refusing to send disallowed field "${key}" to Gemini.`, 'GEMINI_PRIVACY_VIOLATION');
  }
}

module.exports = {
  GeminiError,
  GeminiDisabledError,
  GeminiTimeoutError,
  GeminiRateLimitError,
  GeminiProviderError,
  GeminiInvalidResponseError,
  GeminiPrivacyError,
};
