'use strict';

/**
 * Express application wiring.
 *
 * Phase 0 only mounts the health module plus static frontend hosting.
 * No auth, sessions, CSRF, or domain routes yet - those arrive in later phases.
 */

const path = require('node:path');
const express = require('express');

const config = require('./core/config');
const logger = require('./core/logger');
const { API_PREFIX } = require('./core/constants');
const { notFoundHandler, errorHandler } = require('./core/response');
const healthRoutes = require('./modules/health/health.routes');

const FRONTEND_DIR = path.resolve(__dirname, '..', '..', 'frontend');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  // Very small request log line (redaction handled by the logger).
  app.use((req, res, next) => {
    const start = Date.now();
    const method = req.method;
    // Capture up front: Express rewrites req.url while routing through mounts.
    const url = req.originalUrl;
    res.on('finish', () => {
      logger.info('http', {
        method,
        path: url,
        status: res.statusCode,
        durationMs: Date.now() - start,
      });
    });
    next();
  });

  // --- API routes --------------------------------------------------------
  app.use(`${API_PREFIX}/health`, healthRoutes);

  // Unknown API routes get a JSON 404 (never the static fallback).
  app.use(`${API_PREFIX}`, notFoundHandler);

  // --- Static frontend --------------------------------------------------
  app.use(express.static(path.join(FRONTEND_DIR, 'public')));
  app.use('/src', express.static(path.join(FRONTEND_DIR, 'src')));

  // Anything else: JSON 404 (this is an API-first app; the frontend is a SPA
  // served from '/').
  app.use(notFoundHandler);

  app.use(errorHandler);

  return app;
}

module.exports = { createApp, FRONTEND_DIR, config };
