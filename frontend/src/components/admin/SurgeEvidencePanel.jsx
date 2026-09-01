import React from 'react';
import { SurgeStatusBadge } from './SurgeStatusBadge.jsx';
import { SurgeSignalTable } from './SurgeSignalTable.jsx';
import { BloodGroupBadge } from '../common/BloodGroupBadge.jsx';
import { Activity, BarChart2, ShieldAlert, FileText } from 'lucide-react';

/**
 * Full evidence view for one candidate, used on the detail page.
 */
export function SurgeEvidencePanel({ candidate, event }) {
  if (!candidate) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Candidate Summary */}
      <section className="card">
        <div className="card-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Activity size={18} style={{ color: 'var(--color-accent-700)' }} />
            Candidate Summary
          </h3>
          <SurgeStatusBadge status={candidate.status} isSynthetic={candidate.isSynthetic} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-4)', margin: 'var(--space-3) 0' }}>
          <div>
            <div className="row"><span className="k">Candidate ID</span><span className="v">#{candidate.id}</span></div>
            <div className="row"><span className="k">City</span><span className="v"><strong>{candidate.city}</strong></span></div>
            <div className="row">
              <span className="k">Blood group / component</span>
              <span className="v" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <BloodGroupBadge bloodGroup={candidate.bloodGroup} /> {candidate.component}
              </span>
            </div>
          </div>
          <div>
            <div className="row"><span className="k">Detection Mode</span><span className="v">{candidate.mode}</span></div>
            <div className="row"><span className="k">Observation Window</span><span className="v">{candidate.window.startedAt} → {candidate.window.endedAt}</span></div>
            <div className="row"><span className="k">Detected At</span><span className="v">{candidate.detectedAt}</span></div>
          </div>
        </div>
      </section>

      {/* Demand & Statistical Evidence */}
      <section className="card">
        <div className="card-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <BarChart2 size={18} style={{ color: 'var(--color-primary-800)' }} />
            Demand &amp; Statistical Evidence
          </h3>
        </div>
        <SurgeSignalTable candidate={candidate} />
      </section>

      {/* Baseline Source */}
      <section className="card">
        <div className="card-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <FileText size={18} style={{ color: 'var(--color-primary-800)' }} />
            Baseline Source
          </h3>
        </div>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>
          {candidate.baselineSource === 'SYNTHETIC'
            ? 'SYNTHETIC — cold-start demo baseline. Provided only so anomaly-detection behaviour can be demonstrated before enough real platform history exists. Not learned real-world truth.'
            : 'REAL — generated from this platform’s non-synthetic request history.'}
        </p>
      </section>

      {/* Review Status */}
      <section className="card">
        <div className="card-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <ShieldAlert size={18} style={{ color: 'var(--color-primary-800)' }} />
            Review Status
          </h3>
        </div>

        {candidate.status === 'PENDING' && (
          <p style={{ color: 'var(--color-warning)', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
            ● Awaiting administrator review and operational decision.
          </p>
        )}

        {candidate.status !== 'PENDING' && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="row"><span className="k">Reviewed at</span><span className="v">{candidate.reviewedAt || '—'}</span></div>
            <div className="row"><span className="k">Reviewer (user id)</span><span className="v">{candidate.reviewedByUserId ?? '—'}</span></div>
            <div className="row"><span className="k">Reviewer Note</span><span className="v">{candidate.reviewNote || '—'}</span></div>
          </div>
        )}

        {event && (
          <div
            style={{
              marginTop: 'var(--space-4)',
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-info-bg)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-info-border)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-info-dark)',
            }}
          >
            Confirmed operational surge event #{event.id} — status {event.status}. This confirms the internal blood-demand state only, not an external cause.
          </div>
        )}
      </section>
    </div>
  );
}
