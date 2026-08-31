'use strict';

/**
 * integrations/gemini/gemini.config
 *
 * The Gemini slice of core/config as a small, stable surface. No
 * `process.env` here — core/config is the only reader. The model is ALWAYS
 * `config.gemini.model` (never hard-coded).
 *
 * `__setOverride({ enabled })` exists for tests only: it lets a mocked test
 * exercise the enabled code path without a real key or a config rebuild.
 * Production code never calls it.
 */

const config = require('../../core/config');

let override = null;

function val(key) {
  if (override && key in override) return override[key];
  return config.gemini[key];
}

module.exports = {
  get enabled() {
    return Boolean(val('enabled'));
  },
  get apiKey() {
    return val('apiKey');
  },
  get model() {
    return val('model');
  },
  get timeoutMs() {
    return val('timeoutMs');
  },
  get maxOutputTokens() {
    return val('maxOutputTokens');
  },
  get runLiveTest() {
    return Boolean(val('runLiveTest'));
  },
  /** For the health endpoint: configured (key present) vs enabled (turned on). */
  get configured() {
    return Boolean(config.gemini.apiKey);
  },
  /** Test seam. Pass null to clear. */
  __setOverride(next) {
    override = next;
  },
};
