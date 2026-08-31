'use strict';

/**
 * integrations/gemini/gemini.constants
 *
 * Vocabulary + hard privacy boundary for the Gemini integration.
 */

// Named operations. Used for safe logging and metrics — never contains content.
const GEMINI_OPERATION = Object.freeze({
  OPS_SUMMARY: 'ADMIN_OPERATIONS_SUMMARY',
  CONNECTIVITY_SMOKE: 'CONNECTIVITY_SMOKE',
});

/**
 * Keys that must NEVER appear anywhere in a Gemini prompt or payload.
 * `assertNoForbiddenKeys()` walks the input object recursively and throws if
 * any of these are present (as a key OR, for a few, as an obvious value shape).
 */
const FORBIDDEN_INPUT_KEYS = Object.freeze([
  'password', 'password_hash', 'passwordhash', 'hash',
  'session', 'sessionid', 'session_id', 'sid', 'cookie', 'csrf', 'csrftoken', 'csrf_token',
  'authorization', 'auth', 'token', 'apikey', 'api_key', 'service_role', 'servicerolekey',
  'phone', 'phone_private', 'phoneprivate', 'contact_phone', 'contactphone',
  'email', 'email_private', 'emailprivate', 'contact_email',
  'latitude', 'longitude', 'lat', 'lng', 'lon', 'coords', 'coordinates',
  'approx_latitude', 'approx_longitude', 'live_latitude', 'live_longitude',
  'patient', 'patient_name', 'patientname', 'mrn', 'medical_record',
  'note', 'notes', 'request_note', 'admin_note', 'review_note',
]);

// The de-identified operational-summary input is built ONLY from this allow-list.
const OPS_SUMMARY_ALLOWED_KEYS = Object.freeze([
  'generatedAt', 'windowLabel',
  'openRequests', 'coveredRequests', 'expiredRequests', 'cancelledRequests',
  'totalRequests', 'criticalRequests', 'urgentRequests',
  'activeAllocations', 'completedAllocations',
  'activePledges', 'fulfilledPledges',
  'lowStockBankCount', 'totalInventoryUnits',
  'activeSurgeEventCount', 'pendingSurgeCandidateCount',
  'notificationsQueued', 'notificationsFailed',
  'byBloodGroup', 'byCity',
]);

module.exports = { GEMINI_OPERATION, FORBIDDEN_INPUT_KEYS, OPS_SUMMARY_ALLOWED_KEYS };
