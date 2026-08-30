'use strict';

/**
 * Application entry point.
 *
 * Order matters:
 *   1. Load & validate configuration (fail fast with a readable message).
 *   2. Open the database (creates the file + schema on first run).
 *   3. Start the HTTP server.
 */

// --- 1. Configuration -----------------------------------------------------
let config;
try {
  config = require('./core/config');
} catch (err) {
  process.stderr.write(`\nConfiguration error:\n${err.message}\n\n`);
  process.exit(1);
}

const logger = require('./core/logger');
const { getDb, pingDatabase, closeDatabase } = require('./core/database');
const { createApp } = require('./app');
const notificationWorker = require('./jobs/notification-worker.job');

function start() {
  // --- 2. Database ------------------------------------------------------
  try {
    getDb();
  } catch (err) {
    logger.error('failed to open database', { message: err.message, stack: err.stack });
    process.exit(1);
  }

  if (!pingDatabase()) {
    logger.error('database did not respond to a ping at startup');
    process.exit(1);
  }

  // --- 3. HTTP server -------------------------------------------------
  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info('server listening', {
      port: config.port,
      env: config.nodeEnv,
      origin: config.appOrigin,
    });
    // Start notification worker after server is listening (non-blocking).
    if (!config.isTest) {
      notificationWorker.start();
    }
  });

  const shutdown = (signal) => {
    logger.info('shutting down', { signal });
    notificationWorker.stop();
    server.close(() => {
      closeDatabase();
      process.exit(0);
    });
    // Don't hang forever if connections are stuck.
    setTimeout(() => process.exit(1), 5000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}

if (require.main === module) {
  start();
}

module.exports = { start };
