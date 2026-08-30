'use strict';

/**
 * security/security-headers
 *
 * Central Helmet configuration. The CSP is intentionally strict:
 *   - scripts only from same origin (our frontend is plain ES modules)
 *   - no inline scripts
 *   - no framing (clickjacking protection)
 * Inline styles are allowed because the status/login pages toggle a few
 * classes; no third-party origins are permitted.
 */

const helmet = require('helmet');

const config = require('../core/config');

function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: config.isProduction ? [] : null,
      },
    },
    // Allow the frontend to be loaded normally over plain HTTP on localhost.
    crossOriginEmbedderPolicy: false,
    // HSTS only makes sense once the app is actually served over HTTPS.
    hsts: config.isProduction,
    referrerPolicy: { policy: 'same-origin' },
  });
}

module.exports = { securityHeaders };
