import React from 'react';
import { Link } from 'react-router-dom';
import { SurgeStatusBadge } from './SurgeStatusBadge.jsx';
import { BloodGroupBadge } from '../common/BloodGroupBadge.jsx';
import { ArrowRight } from 'lucide-react';

/**
 * Compact candidate row for the dashboard list.
 */
export function SurgeCandidateCard({ candidate }) {
  return (
    <tr>
      <td>
        <Link
          to={`/admin/surge/candidates/${candidate.id}`}
          style={{ fontWeight: 700, color: 'var(--color-primary-900)' }}
        >
          #{candidate.id}
        </Link>
      </td>
      <td>
        <strong>{candidate.city}</strong>
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <BloodGroupBadge bloodGroup={candidate.bloodGroup} />
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{candidate.component}</span>
        </div>
      </td>
      <td>
        <strong style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-accent-700)' }}>
          {candidate.observedRequests}
        </strong>
      </td>
      <td>{Number(candidate.expectedRequests).toFixed(2)}</td>
      <td>
        <span style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}>
          {candidate.poissonTailProbability}
        </span>
      </td>
      <td>{candidate.distinctHospitals}</td>
      <td>
        <span className="badge" style={{ backgroundColor: 'var(--color-primary-50)', color: 'var(--color-primary-900)', border: '1px solid var(--color-border)', fontWeight: 700 }}>
          {candidate.signalScore}
        </span>
      </td>
      <td>
        <SurgeStatusBadge status={candidate.status} isSynthetic={candidate.isSynthetic} />
      </td>
      <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
        {candidate.detectedAt}
      </td>
    </tr>
  );
}
