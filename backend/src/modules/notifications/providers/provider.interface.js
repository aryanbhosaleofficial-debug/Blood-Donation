'use strict';

/**
 * modules/notifications/providers/provider.interface
 *
 * Documents the provider contract. Each concrete provider must implement
 * a `send(notification)` method that either:
 *   - returns { accepted: true, providerMessageId: string|null }
 *   - throws a typed Error (retryable or permanent)
 *
 * Provider calls MUST NOT occur inside domain transactions.
 * They are invoked only by the notification worker.
 */

class ProviderError extends Error {
  constructor(message, { permanent = false, cause = null } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.permanent = permanent; // true = do not retry; exhaust attempts immediately
    this.cause = cause;
  }
}

module.exports = { ProviderError };
