import React, { useState, useEffect, useCallback } from 'react';
import { allocationsApi } from '../../api/allocations.api.js';
import { BankAllocationList } from '../../components/blood-bank/BankAllocationList.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';

export function AllocationHistoryPage() {
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  const loadAllocations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await allocationsApi.getBankAllocations();
      setAllocations(data?.allocations || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllocations();
  }, [loadAllocations]);

  const handleRelease = async (allocationId) => {
    setError(null);
    setActionSuccess(null);
    try {
      await allocationsApi.releaseAllocation(allocationId);
      setActionSuccess('Allocation released and stock restored to inventory.');
      await loadAllocations();
    } catch (err) {
      setError(err);
    }
  };

  const handleComplete = async (allocationId) => {
    setError(null);
    setActionSuccess(null);
    try {
      await allocationsApi.completeAllocation(allocationId);
      setActionSuccess('Allocation marked as completed.');
      await loadAllocations();
    } catch (err) {
      setError(err);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>My Allocations</h2>
      </div>

      <div className="disclaimer-box">
        Releasing a reserved allocation restores units back to your red-cell inventory atomically. Marking completed records dispatch fulfillment.
      </div>

      <ErrorAlert error={error} onRetry={loadAllocations} />
      {actionSuccess && <div className="form-success">{actionSuccess}</div>}

      <div className="card">
        {loading ? (
          <LoadingSpinner message="Loading bank allocations…" />
        ) : (
          <BankAllocationList
            allocations={allocations}
            onRelease={handleRelease}
            onComplete={handleComplete}
          />
        )}
      </div>
    </div>
  );
}
