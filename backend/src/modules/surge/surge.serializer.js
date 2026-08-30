'use strict';

/**
 * modules/surge/surge.serializer
 *
 * Explicit admin-facing views of surge_candidates / surge_events rows.
 * Never returns raw SQL rows. Contains only aggregate demand evidence —
 * no patient data, request notes, donor identity, or donor coordinates.
 *
 * `poissonTailProbability` is the probability of observing this many or more
 * requests under the configured baseline model — NOT a probability of a
 * disaster.
 */

function candidateView(row) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    mode: row.mode,
    city: row.city,
    bloodGroup: row.blood_group,
    component: row.component,
    window: {
      startedAt: row.window_started_at,
      endedAt: row.window_ended_at,
    },
    observedRequests: row.observed_request_count,
    expectedRequests: Number(row.expected_lambda),
    poissonTailProbability: row.poisson_tail_probability,
    distinctHospitals: row.distinct_hospital_count,
    velocityRatio: row.velocity_ratio,
    previousWindowRequests: row.previous_window_count,
    geographic: {
      signal: row.geographic_signal,
      radiusKm: row.geographic_radius_km,
    },
    inventory: {
      recordedUnits: row.recorded_inventory_units,
      freshRows: row.fresh_inventory_rows,
      staleRows: row.stale_inventory_rows,
      depletionUnits: row.inventory_depletion_units,
    },
    signalScore: row.signal_score,
    baselineSource: row.baseline_source,
    isSynthetic: Boolean(row.is_synthetic),
    detectedAt: row.detected_at,
    reviewedAt: row.reviewed_at ?? null,
    reviewedByUserId: row.reviewed_by_user_id ?? null,
    reviewNote: row.review_note ?? null,
  };
}

function candidatePage(rows, total, limit, offset) {
  return {
    candidates: rows.map(candidateView),
    pagination: { total, limit, offset, hasMore: offset + rows.length < total },
  };
}

function eventView(row) {
  if (!row) return null;
  return {
    id: row.id,
    candidateId: row.candidate_id,
    status: row.status,
    city: row.city,
    bloodGroup: row.blood_group,
    component: row.component,
    summary: row.summary ?? null,
    adminNote: row.admin_note ?? null,
    confirmedByUserId: row.confirmed_by_user_id ?? null,
    confirmedAt: row.confirmed_at,
    isSynthetic: Boolean(row.is_synthetic),
    closedAt: row.closed_at ?? null,
    createdAt: row.created_at,
  };
}

function eventPage(rows, total, limit, offset) {
  return {
    events: rows.map(eventView),
    pagination: { total, limit, offset, hasMore: offset + rows.length < total },
  };
}

module.exports = { candidateView, candidatePage, eventView, eventPage };
