'use strict';

/**
 * modules/notifications/notification-builders
 *
 * Pure functions that build notification data objects for specific domain
 * events. These keep domain transaction files free from scattered UI strings.
 *
 * Privacy rules enforced here:
 *   - Hospital-bound notifications use only public_reference for donor identity.
 *   - No donor phone, email, latitude, longitude, internal ID.
 *   - No patient data in payloads.
 *   - No medical-readiness wording.
 */

const { NOTIFICATION_EVENT, NOTIFICATION_ENTITY } = require('./notifications.constants');

// --- Module 03: Request Broadcasts ---

function buildRequestBroadcastNotification({ requestId, bloodGroup, urgency, component, hospitalName, city }) {
  return {
    eventType: NOTIFICATION_EVENT.REQUEST_BROADCAST_RECEIVED,
    entityType: NOTIFICATION_ENTITY.REQUEST,
    entityId: requestId,
    dedupeKey: `REQUEST_BROADCAST_RECEIVED:req=${requestId}`,
    title: 'New Emergency Request Received',
    message: `${bloodGroup} (${component}) — ${urgency} urgency — from ${hospitalName}, ${city}.`,
    payload: { requestId, bloodGroup, component, urgency, hospitalName, city },
  };
}

// --- Module 04: Allocations ---

function buildAllocationReservedNotification({ allocationId, requestId, unitsReserved, bankName }) {
  return {
    eventType: NOTIFICATION_EVENT.BANK_ALLOCATION_RESERVED,
    entityType: NOTIFICATION_ENTITY.ALLOCATION,
    entityId: allocationId,
    dedupeKey: `BANK_ALLOCATION_RESERVED:alloc=${allocationId}`,
    title: 'Blood Bank Reservation Confirmed',
    message: `${bankName} reserved ${unitsReserved} unit(s) for Request #${requestId}.`,
    payload: { requestId, allocationId, unitsReserved, bankName },
  };
}

function buildAllocationReleasedHospitalNotification({ allocationId, requestId, unitsReserved, bankName }) {
  return {
    eventType: NOTIFICATION_EVENT.BANK_ALLOCATION_RELEASED,
    entityType: NOTIFICATION_ENTITY.ALLOCATION,
    entityId: allocationId,
    dedupeKey: `BANK_ALLOCATION_RELEASED:alloc=${allocationId}:hospitalUser`,
    title: 'Bank Reservation Released',
    message: `${bankName} released ${unitsReserved} unit(s) previously reserved for Request #${requestId}.`,
    payload: { requestId, allocationId, unitsReserved, bankName },
  };
}

function buildAllocationCompletedNotification({ allocationId, requestId, unitsReserved, bankName }) {
  return {
    eventType: NOTIFICATION_EVENT.BANK_ALLOCATION_COMPLETED,
    entityType: NOTIFICATION_ENTITY.ALLOCATION,
    entityId: allocationId,
    dedupeKey: `BANK_ALLOCATION_COMPLETED:alloc=${allocationId}`,
    title: 'Bank Allocation Marked Complete',
    message: `${bankName} marked their allocation of ${unitsReserved} unit(s) as complete for Request #${requestId}. Medical professionals determine clinical suitability.`,
    payload: { requestId, allocationId, unitsReserved, bankName },
  };
}

// --- Module 04: Coverage Transitions ---

function buildRequestCoveredNotification({ requestId, hospitalName }) {
  return {
    eventType: NOTIFICATION_EVENT.REQUEST_COVERED,
    entityType: NOTIFICATION_ENTITY.REQUEST,
    entityId: requestId,
    dedupeKey: `REQUEST_COVERED:req=${requestId}`,
    title: 'Request Coverage Target Reached',
    message: `Coverage target reached through recorded blood-bank allocations for Request #${requestId}. Medical professionals determine clinical suitability.`,
    payload: { requestId },
  };
}

function buildRequestReopenedNotification({ requestId, allocationId }) {
  return {
    eventType: NOTIFICATION_EVENT.REQUEST_REOPENED,
    entityType: NOTIFICATION_ENTITY.REQUEST,
    entityId: requestId,
    dedupeKey: `REQUEST_REOPENED:req=${requestId}:released=${allocationId}`,
    title: 'Request Requires Additional Sourcing',
    message: `A previous reservation was released. Additional sourcing is required for Request #${requestId}.`,
    payload: { requestId, allocationId },
  };
}

// --- Module 03: Request Lifecycle ---

function buildRequestCancelledNotification({ requestId, recipientUserId }) {
  return {
    eventType: NOTIFICATION_EVENT.REQUEST_CANCELLED,
    entityType: NOTIFICATION_ENTITY.REQUEST,
    entityId: requestId,
    dedupeKey: `REQUEST_CANCELLED:req=${requestId}:user=${recipientUserId}`,
    title: 'Emergency Request Cancelled',
    message: `Emergency Request #${requestId} has been cancelled.`,
    payload: { requestId },
  };
}

function buildRequestCompletedNotification({ requestId, recipientUserId }) {
  return {
    eventType: NOTIFICATION_EVENT.REQUEST_COMPLETED,
    entityType: NOTIFICATION_ENTITY.REQUEST,
    entityId: requestId,
    dedupeKey: `REQUEST_COMPLETED:req=${requestId}:user=${recipientUserId}`,
    title: 'Emergency Request Completed',
    message: `Emergency Request #${requestId} has been marked as completed.`,
    payload: { requestId },
  };
}

// --- Module 08: Request Expiry ---

function buildRequestExpiredNotification({ requestId, recipientUserId }) {
  return {
    eventType: NOTIFICATION_EVENT.REQUEST_EXPIRED,
    entityType: NOTIFICATION_ENTITY.REQUEST,
    entityId: requestId,
    dedupeKey: `REQUEST_EXPIRED:req=${requestId}:user=${recipientUserId}`,
    title: 'Emergency Request Expired',
    message: `Emergency Request #${requestId} has expired and was closed automatically.`,
    payload: { requestId },
  };
}

// --- Module 05: Donor Alerts ---

function buildDonorAlertNotification({ alertId, bloodGroup, component, urgency, hospitalName, city, locality, expiresAt }) {
  const loc = locality ? `${locality}, ${city}` : city;
  return {
    eventType: NOTIFICATION_EVENT.DONOR_ALERT_CREATED,
    entityType: NOTIFICATION_ENTITY.DONOR_ALERT,
    entityId: alertId,
    dedupeKey: `DONOR_ALERT_CREATED:alert=${alertId}`,
    title: 'Potential Donor Response Requested',
    message: `A potential red-cell donor response is requested for ${bloodGroup} (${component}) at ${hospitalName}, ${loc}. Urgency: ${urgency}. Medical professionals determine eligibility.`,
    payload: { alertId, bloodGroup, component, urgency, hospitalName, city, locality: locality ?? null, expiresAt: expiresAt ?? null },
  };
}

// --- Module 06: Pledges ---

function buildPledgeCreatedForHospitalNotification({ pledgeId, requestId, publicReference }) {
  return {
    eventType: NOTIFICATION_EVENT.DONOR_PLEDGE_CREATED,
    entityType: NOTIFICATION_ENTITY.PLEDGE,
    entityId: pledgeId,
    dedupeKey: `DONOR_PLEDGE_CREATED:pledge=${pledgeId}`,
    title: 'Potential Donor Pledged',
    message: `Potential donor ${publicReference} has pledged to respond for Request #${requestId}.`,
    payload: { requestId, pledgeId, publicReference },
  };
}

function buildPledgeConfirmedForDonorNotification({ pledgeId, requestId, hospitalName, city }) {
  return {
    eventType: NOTIFICATION_EVENT.DONOR_PLEDGE_CONFIRMED,
    entityType: NOTIFICATION_ENTITY.PLEDGE,
    entityId: pledgeId,
    dedupeKey: `DONOR_PLEDGE_CONFIRMED:pledge=${pledgeId}`,
    title: 'Pledge Recorded',
    message: `Your potential donor pledge for ${hospitalName}, ${city} (Request #${requestId}) was recorded. Medical professionals determine eligibility.`,
    payload: { requestId, pledgeId, hospitalName, city },
  };
}

function buildPledgeCancelledForHospitalNotification({ pledgeId, requestId, publicReference }) {
  return {
    eventType: NOTIFICATION_EVENT.DONOR_PLEDGE_CANCELLED,
    entityType: NOTIFICATION_ENTITY.PLEDGE,
    entityId: pledgeId,
    dedupeKey: `DONOR_PLEDGE_CANCELLED:pledge=${pledgeId}`,
    title: 'Potential Donor Cancelled Pledge',
    message: `Potential donor ${publicReference} cancelled their pledge for Request #${requestId}.`,
    payload: { requestId, pledgeId, publicReference },
  };
}

function buildPledgeArrivedForHospitalNotification({ pledgeId, requestId, publicReference }) {
  return {
    eventType: NOTIFICATION_EVENT.DONOR_PLEDGE_ARRIVED,
    entityType: NOTIFICATION_ENTITY.PLEDGE,
    entityId: pledgeId,
    dedupeKey: `DONOR_PLEDGE_ARRIVED:pledge=${pledgeId}`,
    title: 'Potential Donor Reported Arrival',
    message: `Potential donor ${publicReference} reported arrival for Request #${requestId}. Medical professionals determine eligibility and suitability.`,
    payload: { requestId, pledgeId, publicReference },
  };
}

function buildPledgeDeferredForDonorNotification({ pledgeId, requestId }) {
  return {
    eventType: NOTIFICATION_EVENT.DONOR_PLEDGE_DEFERRED,
    entityType: NOTIFICATION_ENTITY.PLEDGE,
    entityId: pledgeId,
    dedupeKey: `DONOR_PLEDGE_DEFERRED:pledge=${pledgeId}`,
    title: 'Pledge Deferred — No Longer Required',
    message: `Blood-bank coverage was found for Request #${requestId}. Your response is no longer required for this request.`,
    payload: { requestId, pledgeId },
  };
}

// --- Module 09: Surge detection (ADMIN recipients only) ---

function buildSurgeCandidateDetectedNotification({ candidateId, city, bloodGroup, component, recipientUserId }) {
  return {
    eventType: NOTIFICATION_EVENT.SURGE_CANDIDATE_DETECTED,
    entityType: NOTIFICATION_ENTITY.SURGE_CANDIDATE,
    entityId: candidateId,
    dedupeKey: `SURGE_CANDIDATE_DETECTED:cand=${candidateId}:user=${recipientUserId}`,
    title: 'Unusual Blood-Demand Pattern Detected',
    message: `Unusual ${bloodGroup} ${component} demand detected in ${city}. Admin review is required. This is not a disaster prediction.`,
    payload: { candidateId, city, bloodGroup, component },
  };
}

function buildSurgeConfirmedNotification({ candidateId, eventId, city, bloodGroup, component, recipientUserId }) {
  return {
    eventType: NOTIFICATION_EVENT.SURGE_CONFIRMED,
    entityType: NOTIFICATION_ENTITY.SURGE_EVENT,
    entityId: eventId,
    dedupeKey: `SURGE_CONFIRMED:cand=${candidateId}:user=${recipientUserId}`,
    title: 'Operational Blood-Demand Surge Confirmed',
    message: `An operational blood-demand surge has been confirmed for ${city} / ${bloodGroup} / ${component}. This confirms the internal demand state only, not an external cause.`,
    payload: { candidateId, eventId, city, bloodGroup, component },
  };
}

function buildSurgeRejectedNotification({ candidateId, city, bloodGroup, component, recipientUserId }) {
  return {
    eventType: NOTIFICATION_EVENT.SURGE_REJECTED,
    entityType: NOTIFICATION_ENTITY.SURGE_CANDIDATE,
    entityId: candidateId,
    dedupeKey: `SURGE_REJECTED:cand=${candidateId}:user=${recipientUserId}`,
    title: 'Surge Candidate Rejected',
    message: `The surge candidate for ${city} / ${bloodGroup} / ${component} was reviewed and rejected by an administrator.`,
    payload: { candidateId, city, bloodGroup, component },
  };
}

module.exports = {
  buildRequestBroadcastNotification,
  buildAllocationReservedNotification,
  buildAllocationReleasedHospitalNotification,
  buildAllocationCompletedNotification,
  buildRequestCoveredNotification,
  buildRequestReopenedNotification,
  buildRequestCancelledNotification,
  buildRequestCompletedNotification,
  buildRequestExpiredNotification,
  buildDonorAlertNotification,
  buildPledgeCreatedForHospitalNotification,
  buildPledgeConfirmedForDonorNotification,
  buildPledgeCancelledForHospitalNotification,
  buildPledgeArrivedForHospitalNotification,
  buildPledgeDeferredForDonorNotification,
  buildSurgeCandidateDetectedNotification,
  buildSurgeConfirmedNotification,
  buildSurgeRejectedNotification,
};
