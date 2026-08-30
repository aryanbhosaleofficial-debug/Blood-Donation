'use strict';

/**
 * modules/notifications/providers/test.provider
 *
 * Controllable provider for test scenarios.
 *
 * Modes:
 *   SUCCESS      — always succeeds immediately
 *   FAIL_ONCE    — fails on the first call, then succeeds
 *   ALWAYS_FAIL  — always throws a retryable error
 *   PERMANENT    — throws a permanent (non-retryable) error
 */

const { ProviderError } = require('./provider.interface');

class TestProvider {
  constructor(mode = 'SUCCESS') {
    this.mode = mode;
    this._callCount = 0;
    this.sentNotifications = [];
  }

  get channel() { return 'TEST'; }

  send(notification) {
    this._callCount += 1;
    if (this.mode === 'SUCCESS') {
      this.sentNotifications.push(notification);
      return { accepted: true, providerMessageId: `test-${this._callCount}` };
    }
    if (this.mode === 'FAIL_ONCE') {
      if (this._callCount === 1) throw new ProviderError('Provider temporarily unavailable', { permanent: false });
      this.sentNotifications.push(notification);
      return { accepted: true, providerMessageId: `test-${this._callCount}` };
    }
    if (this.mode === 'ALWAYS_FAIL') {
      throw new ProviderError('Provider unavailable', { permanent: false });
    }
    if (this.mode === 'PERMANENT') {
      throw new ProviderError('Permanent provider error', { permanent: true });
    }
    throw new Error(`Unknown test provider mode: ${this.mode}`);
  }

  reset() {
    this._callCount = 0;
    this.sentNotifications = [];
  }
}

module.exports = { TestProvider };
