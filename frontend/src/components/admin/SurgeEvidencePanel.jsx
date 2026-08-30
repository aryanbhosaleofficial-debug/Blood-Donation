import React from 'react';
import { SurgeStatusBadge } from './SurgeStatusBadge.jsx';
import { SurgeSignalTable } from './SurgeSignalTable.jsx';

/**
 * Full evidence view for one candidate, used on the detail page.
 */
export function SurgeEvidencePanel({ candidate, event }) {
  if (!candidate) return null;
  return (
    <div>
      <section className="card">
        <h3>Candidate Summary</h3>
        <p>
          <SurgeStatusBadge status={candidate.status} isSynthetic={candidate.isSynthetic} />
        </p>
        <div className="row"><span className="k">City</span><span className="v">{candidate.city}</span></div>
        <div className="row"><span className="k">Blood group / component</span><span className="v">{candidate.bloodGroup} / {candidate.component}</span></div>
        <div className="row"><span className="k">Mode</span><span className="v">{candidate.mode}</span></div>
        <div className="row"><span className="k">Window</span><span className="v">{candidate.window.startedAt} → {candidate.window.endedAt}</span></div>
        <div className="row"><span className="k">Detected at</span><span className="v">{candidate.detectedAt}</span></div>
      </section>

      <section className="card">
        <h3>Demand &amp; Statistical Evidence</h3>
        <SurgeSignalTable candidate={candidate} />
      </section>

      <section className="card">
        <h3>Baseline Source</h3>
        <p>
          {candidate.baselineSource === 'SYNTHETIC'
            ? 'SYNTHETIC — cold-start demo baseline. Provided only so anomaly-detection behaviour can be demonstrated before enough real platform history exists. Not learned real-world truth.'
            : 'REAL — generated from this platform’s non-synthetic request history.'}
        </p>
      </section>

      <section className="card">
        <h3>Review Status</h3>
        {candidate.status === 'PENDING' && <p>Awaiting administrator review.</p>}
        {candidate.status !== 'PENDING' && (
          <>
            <div className="row"><span className="k">Reviewed at</span><span className="v">{candidate.reviewedAt || '—'}</span></div>
            <div className="row"><span className="k">Reviewer (user id)</span><span className="v">{candidate.reviewedByUserId ?? '—'}</span></div>
            <div className="row"><span className="k">Note</span><span className="v">{candidate.reviewNote || '—'}</span></div>
          </>
        )}
        {event && (
          <p style={{ marginTop: '0.5rem' }}>
            Confirmed operational surge event #{event.id} — status {event.status}.
            This confirms the internal blood-demand state only, not an external cause.
          </p>
        )}
      </section>
    </div>
  );
}
