'use strict';

/**
 * Express application wiring.
 *
 * Module 00: config, database, health, static frontend.
 * Module 01: security headers, sessions, CSRF + Origin validation, auth routes.
 * Module 02: organization profiles, verification, and blood-bank inventory.
 * Module 03: emergency requests and broadcast visibility.
 * Module 04: atomic blood-bank allocations and coverage transitions.
 * Module 05: donor profiles, potential matching, and private in-app alerts.
 * Module 06: atomic donor pledges, temporary location, and coarse ETA bands.
 * Module 07: transactional notification outbox, worker, and notification REST APIs.
 *
 * Middleware order matters:
 *   security headers
 *   -> request log
 *   -> JSON body parsing (size-limited)
 *   -> session
 *   -> CSRF / Origin validation (state-changing requests)
 *   -> routes
 *   -> not-found
 *   -> error handler
 */

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const SqliteStore = require('connect-sqlite3')(session);

const config = require('./core/config');
const logger = require('./core/logger');
const { API_PREFIX, SESSION_COOKIE_NAME } = require('./core/constants');
const { securityHeaders } = require('./security/security-headers');
const { createCsrfMiddleware } = require('./security/csrf');
const { notFound } = require('./middleware/not-found');
const { errorHandler } = require('./middleware/error-handler');
const healthRoutes = require('./modules/health/health.routes');
const authRoutes = require('./modules/auth/auth.routes');
const hospitalRoutes = require('./modules/hospitals/hospitals.routes');
const bloodBankRoutes = require('./modules/blood-banks/blood-banks.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const requestRoutes = require('./modules/requests/requests.routes');
const bankRequestRoutes = require('./modules/broadcasts/broadcasts.routes');
const allocationRoutes = require('./modules/allocations/allocations.routes');
const donorRoutes = require('./modules/donors/donors.routes');
const donorAlertRoutes = require('./modules/donor-alerts/donor-alerts.routes');
const pledgeRoutes = require('./modules/pledges/pledges.routes');
const notificationRoutes = require('./modules/notifications/notifications.routes');
const auditRoutes = require('./modules/audit/audit.routes');
const metricsRoutes = require('./modules/metrics/metrics.routes');
const surgeRoutes = require('./modules/surge/surge.routes');

const FRONTEND_DIR = path.resolve(__dirname, '..', '..', 'frontend');

// Paths that are state-changing but must NOT require an authenticated CSRF
// token (they still get Origin validation). See auth.routes.js / spec 01.20.
const CSRF_EXEMPT_PATHS = [`${API_PREFIX}/auth/login`];

function buildSessionMiddleware() {
  const maxAgeMs = config.sessionMaxAgeHours * 60 * 60 * 1000;

  const options = {
    name: SESSION_COOKIE_NAME,
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.isProduction, // localhost HTTP dev still works
      maxAge: maxAgeMs,
      path: '/',
    },
  };

  // Real runs persist sessions in SQLite; tests use the in-memory store so each
  // run is isolated and fast.
  if (!config.isTest) {
    fs.mkdirSync(path.dirname(config.sessionDatabasePath), { recursive: true });
    options.store = new SqliteStore({
      dir: path.dirname(config.sessionDatabasePath),
      db: path.basename(config.sessionDatabasePath),
      table: 'sessions',
      concurrentDB: true,
    });
  }

  return session(options);
}

function createApp({ mountExtra } = {}) {
  const app = express();

  app.disable('x-powered-by');
  if (config.trustProxy) {
    app.set('trust proxy', 1);
  }

  app.use(securityHeaders());

  // Small request log line (method/path/status/duration only - never headers).
  app.use((req, res, next) => {
    const start = Date.now();
    const method = req.method;
    const url = req.originalUrl;
    res.on('finish', () => {
      logger.info('http', { method, path: url, status: res.statusCode, durationMs: Date.now() - start });
    });
    next();
  });

  app.use(express.json({ limit: config.jsonBodyLimit }));

  app.use(buildSessionMiddleware());

  // CSRF + Origin validation for every state-changing request.
  app.use(createCsrfMiddleware({ exemptPaths: CSRF_EXEMPT_PATHS }));

  // --- API routes ------------------------------------------------------
  app.use(`${API_PREFIX}/health`, healthRoutes);
  app.use(`${API_PREFIX}/auth`, authRoutes);
  app.use(`${API_PREFIX}/hospital`, hospitalRoutes);
  app.use(`${API_PREFIX}/blood-bank/requests`, bankRequestRoutes);
  app.use(`${API_PREFIX}/blood-bank`, bloodBankRoutes);
  app.use(`${API_PREFIX}/admin/audit-logs`, auditRoutes);
  app.use(`${API_PREFIX}/admin/metrics`, metricsRoutes);
  app.use(`${API_PREFIX}/admin/surge`, surgeRoutes);
  app.use(`${API_PREFIX}/admin`, adminRoutes);
  app.use(`${API_PREFIX}/requests`, requestRoutes);
  app.use(`${API_PREFIX}/allocations`, allocationRoutes);
  app.use(`${API_PREFIX}/donor/alerts`, donorAlertRoutes);
  app.use(`${API_PREFIX}/donor/pledges`, pledgeRoutes);
  app.use(`${API_PREFIX}/donor`, donorRoutes);
  app.use(`${API_PREFIX}/notifications`, notificationRoutes);

  // Test-only protected routes (e.g. for CSRF / role assertions). Never mounted
  // in a normal run - the test harness passes this in.
  if (typeof mountExtra === 'function') {
    mountExtra(app, express);
  }

  // Unknown API routes -> JSON 404 (never the static fallback).
  app.use(`${API_PREFIX}`, notFound);

  // --- Static frontend ----------------------------------------------
  // Prefer the production build (`npm run build:frontend`) when present, so a
  // single `npm start` serves the whole app from one origin. Otherwise fall
  // back to the raw source tree (used with the Vite dev server).
  const DIST_DIR = path.join(FRONTEND_DIR, 'dist');
  const usingBuild = fs.existsSync(path.join(DIST_DIR, 'index.html'));
  const STATIC_DIR = usingBuild ? DIST_DIR : FRONTEND_DIR;

  app.use(express.static(STATIC_DIR));
  if (!usingBuild) {
    app.use('/src', express.static(path.join(FRONTEND_DIR, 'src')));
  }

  // SPA fallback: a non-API GET that did not match a static file returns
  // index.html so client-side routes (/admin, /hospital, …) work on refresh.
  if (usingBuild) {
    app.get('*', (req, res, next) => {
      if (req.path.startsWith(API_PREFIX)) return next();
      res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
  }

  // Everything else -> JSON 404.
  app.use(notFound);

  app.use(errorHandler);

  return app;
}

module.exports = { createApp, FRONTEND_DIR };
