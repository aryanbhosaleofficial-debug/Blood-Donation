'use strict';

/**
 * integrations/gemini/gemini.service
 *
 * The one approved Gemini feature: an ADMIN-only, plain-language summary of
 * ALREADY de-identified operational metrics. It is advisory text only.
 *
 * Hard boundaries (also documented in docs/safety.md):
 *   - Gemini output is NEVER authoritative. It does not determine medical
 *     eligibility, blood compatibility, allocation, coverage, or surge
 *     confirmation, and it never gates authorization.
 *   - Gemini NEVER receives passwords, hashes, sessions, cookies, CSRF
 *     tokens, donor phone/email, live coordinates, patient identifiers, or
 *     free-text notes. Input is built from an allow-list and re-checked.
 *   - A Gemini failure (disabled, timeout, 429, network, bad response) is
 *     non-fatal: the caller gets `{ available: false, reason }`.
 *   - No Gemini call happens inside a database transaction.
 *
 * Testability: `setClient()` swaps in the mock adapter; default tests never
 * hit the network.
 */

const logger = require('../../core/logger');
const geminiConfig = require('./gemini.config');
const realClient = require('./gemini.client');
const { GEMINI_OPERATION, OPS_SUMMARY_ALLOWED_KEYS } = require('./gemini.constants');
const { assertNoForbiddenKeys, pickAllowed } = require('./gemini.sanitizer');
const { GeminiError, GeminiDisabledError } = require('./gemini.errors');

let client = realClient;

/** Test seam: inject a mock/stub client exposing generateText(). */
function setClient(next) {
  client = next || realClient;
}

const SYSTEM_INSTRUCTION = [
  'You summarize internal blood-bank coordination metrics for an operations administrator.',
  'You are given ONLY aggregate, de-identified counts. There are no patients or donors named.',
  'Write 3-5 short sentences. State what the numbers show and where attention may be needed.',
  'Do NOT give medical advice. Do NOT claim any external cause (no disasters, outbreaks, accidents).',
  'Do NOT invent numbers that were not provided. If data is sparse, say so plainly.',
].join(' ');

function buildPrompt(safeMetrics) {
  return [
    'Operational snapshot (all values are aggregate counts):',
    JSON.stringify(safeMetrics, null, 2),
    '',
    'Write the summary now.',
  ].join('\n');
}

/**
 * @param {object} rawMetrics  aggregate metrics from the metrics service
 * @param {{ correlationId?: string }} [opts]
 * @returns {Promise<{ available: boolean, summary?: string, model?: string, reason?: string }>}
 */
async function summarizeOperations(rawMetrics, opts = {}) {
  const operation = GEMINI_OPERATION.OPS_SUMMARY;
  const correlationId = opts.correlationId || null;
  const startedAt = Date.now();

  if (!geminiConfig.enabled) {
    return { available: false, reason: 'GEMINI_DISABLED' };
  }

  // 1. Reduce to the allow-list, then 2. hard-assert nothing forbidden slipped in.
  const safeMetrics = pickAllowed(rawMetrics || {}, OPS_SUMMARY_ALLOWED_KEYS);
  assertNoForbiddenKeys(safeMetrics);

  const prompt = buildPrompt(safeMetrics);
  assertNoForbiddenKeys({ prompt: safeMetrics }); // prompt is derived only from safeMetrics

  try {
    const result = await client.generateText({
      prompt,
      systemInstruction: SYSTEM_INSTRUCTION,
    });
    logger.info('gemini call succeeded', {
      operation,
      model: result.model,
      durationMs: Date.now() - startedAt,
      correlationId,
      promptTokens: result.usage.promptTokenCount ?? null,
      outputTokens: result.usage.candidatesTokenCount ?? null,
      success: true,
    });
    return { available: true, summary: result.text, model: result.model };
  } catch (err) {
    const code = err instanceof GeminiError ? err.code : 'GEMINI_ERROR';
    logger.warn('gemini call failed', {
      operation,
      model: geminiConfig.model,
      durationMs: Date.now() - startedAt,
      correlationId,
      success: false,
      errorCode: code,
    });
    if (err instanceof GeminiDisabledError) return { available: false, reason: 'GEMINI_DISABLED' };
    return { available: false, reason: code };
  }
}

module.exports = { summarizeOperations, setClient, GEMINI_OPERATION };
