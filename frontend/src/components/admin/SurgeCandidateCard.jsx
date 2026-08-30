import React from 'react';
import { Link } from 'react-router-dom';
import { SurgeStatusBadge } from './SurgeStatusBadge.jsx';

/**
 * Compact candidate row for the dashboard list.
 */
export function SurgeCandidateCard({ candidate }) {
  return (
    <tr>
      <td>
        <Link to={`/admin/surge/candidates/${candidate.id}`}>#{candidate.id}</Link>
      </td>
      <td>{candidate.city}</td>
      <td>{candidate.bloodGroup} / {candidate.component}</td>
      <td>{candidate.observedRequests}</td>
      <td>{Number(candidate.expectedRequests).toFixed(2)}</td>
      <td>{candidate.poissonTailProbability}</td>
      <td>{candidate.distinctHospitals}</td>
      <td>{candidate.signalScore}</td>
      <td><SurgeStatusBadge status={candidate.status} isSynthetic={candidate.isSynthetic} /></td>
      <td>{candidate.detectedAt}</td>
    </tr>
  );
}
