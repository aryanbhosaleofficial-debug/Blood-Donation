'use strict';

/**
 * modules/surge/baseline.repository
 *
 * SQL for demand_baselines. Parameterized statements only.
 * is_synthetic = 1 rows are the cold-start demo baseline; is_synthetic = 0
 * rows are generated from real non-synthetic request history. The two are
 * never mixed by a single query.
 */

function upsert(db, {
  city, bloodGroup, component, localHour, lambda,
  sampleDays = 0, requestCount = 0, isSynthetic = 0,
  validFrom = null, validTo = null,
}) {
  db.prepare(`
    INSERT INTO demand_baselines
      (city, blood_group, component, local_hour, lambda, sample_days, request_count,
       is_synthetic, generated_at, valid_from, valid_to)
    VALUES (@city, @bloodGroup, @component, @localHour, @lambda, @sampleDays, @requestCount,
            @isSynthetic, strftime('%Y-%m-%dT%H:%M:%fZ','now'), @validFrom, @validTo)
    ON CONFLICT (city, blood_group, component, local_hour, is_synthetic) DO UPDATE SET
      lambda = excluded.lambda,
      sample_days = excluded.sample_days,
      request_count = excluded.request_count,
      generated_at = excluded.generated_at,
      valid_from = excluded.valid_from,
      valid_to = excluded.valid_to
  `).run({
    city: String(city).trim(),
    bloodGroup, component, localHour,
    lambda, sampleDays, requestCount,
    isSynthetic: isSynthetic ? 1 : 0,
    validFrom, validTo,
  });
}

function find(db, { city, bloodGroup, component, localHour, isSynthetic }) {
  return db.prepare(`
    SELECT * FROM demand_baselines
    WHERE city = ? COLLATE NOCASE AND blood_group = ? AND component = ?
      AND local_hour = ? AND is_synthetic = ?
  `).get(String(city).trim(), bloodGroup, component, localHour, isSynthetic ? 1 : 0);
}

function countBySynthetic(db, isSynthetic) {
  return db.prepare('SELECT COUNT(*) AS n FROM demand_baselines WHERE is_synthetic = ?')
    .get(isSynthetic ? 1 : 0).n;
}

function maxSampleDays(db, isSynthetic) {
  const row = db.prepare('SELECT MAX(sample_days) AS d FROM demand_baselines WHERE is_synthetic = ?')
    .get(isSynthetic ? 1 : 0);
  return row && row.d != null ? row.d : 0;
}

function deleteBySynthetic(db, isSynthetic) {
  return db.prepare('DELETE FROM demand_baselines WHERE is_synthetic = ?').run(isSynthetic ? 1 : 0);
}

module.exports = { upsert, find, countBySynthetic, maxSampleDays, deleteBySynthetic };
