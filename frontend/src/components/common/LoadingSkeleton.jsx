import React from 'react';

export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div className="table-responsive">
      <table>
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}>
                <div className="skeleton skeleton-text" style={{ width: '70%' }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c}>
                  <div className="skeleton skeleton-text" style={{ width: c === 0 ? '80%' : '50%' }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CardSkeleton({ count = 3 }) {
  return (
    <div className="dashboard-stats-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card skeleton-card skeleton" />
      ))}
    </div>
  );
}
