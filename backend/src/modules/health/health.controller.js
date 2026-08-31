'use strict';

const { pingDatabase, getSchemaVersion } = require('../../core/database');
const { sendSuccess } = require('../../core/response');
const { ServiceUnavailableError } = require('../../core/errors');
const config = require('../../core/config');

const startedAt = Date.now();

/**
 * GET /api/health
 *
 * Verifies the process is up and the database connection is alive. Used to
 * confirm the app started correctly before a demo.
 */
function getHealth(req, res, next) {
  try {
    if (!pingDatabase()) {
      throw new ServiceUnavailableError('Database connection is not available.');
    }
    sendSuccess(res, {
      status: 'ok',
      db: 'ok',
      // Which database backend is active. No URL, key, or connection string.
      databaseProvider:
        config.database.provider === 'supabase' ? 'supabase-postgresql' : 'sqlite',
      schemaVersion: getSchemaVersion(),
      // Gemini posture only — never triggers a live Gemini call.
      geminiConfigured: Boolean(config.gemini.apiKey),
      geminiEnabled: config.gemini.enabled === true,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getHealth };
