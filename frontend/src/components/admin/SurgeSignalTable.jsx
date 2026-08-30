import React from 'react';

/**
 * Renders the supporting-signal rows of a candidate as a plain table.
 * Every value is rendered as React text content, so HTML-like strings show
 * literally. No raw-HTML injection APIs are used anywhere in this component.
 */
export function SurgeSignalTable({ candidate }) {
  if (!candidate) return null;
  const g = candidate.geographic || {};
  const inv = candidate.inventory || {};

  const rows = [
    ['Observed requests (window)', candidate.observedRequests],
    ['Expected requests (baseline)', Number(candidate.expectedRequests).toFixed(2)],
    ['Upper-tail probability', candidate.poissonTailProbability],
    ['Distinct requesting hospitals', candidate.distinctHospitals],
    ['Previous-window requests', candidate.previousWindowRequests],
    ['Velocity ratio', candidate.velocityRatio],
    ['Geographic signal', g.signal + (g.radiusKm != null ? ` (~${g.radiusKm} km)` : '')],
    ['Recorded matching red-cell units (fresh)', inv.recordedUnits],
    ['Fresh inventory rows', inv.freshRows],
    ['Stale inventory rows', inv.staleRows],
    ['Recorded depletion during window', inv.depletionUnits],
    ['Ranking score (0–100)', candidate.signalScore],
    ['Baseline source', candidate.baselineSource],
  ];

  return (
    <div className="table-responsive">
      <table>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th style={{ textAlign: 'left', width: '55%' }}>{label}</th>
              <td>{value === null || value === undefined ? '—' : String(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
        Upper-tail probability is the probability of observing this many or more
        requests under the configured baseline model. It is <strong>not</strong> a
        probability of a disaster.
      </p>
    </div>
  );
}
