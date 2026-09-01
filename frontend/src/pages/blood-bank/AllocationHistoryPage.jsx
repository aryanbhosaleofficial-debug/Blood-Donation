import React, { useState, useEffect, useCallback } from 'react';
import { allocationsApi } from '../../api/allocations.api.js';
import { BankAllocationList } from '../../components/blood-bank/BankAllocationList.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { InfoBanner } from '../../components/common/InfoBanner.jsx';
import { Button } from '../../components/common/Button.jsx';
import { RefreshCw, CheckCircle2 } from 'lucide-react';
import { useToast } from '../../components/common/ToastContext.jsx';

export function AllocationHistoryPage() {
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const toast = useToast();

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
      const msg = 'Allocation released and stock restored to inventory.';
      setActionSuccess(msg);
      toast.success(msg);
      await loadAllocations();
    } catch (err) {
      setError(err);
      toast.error('Failed to release allocation.');
    }
  };

  const handleComplete = async (allocationId) => {
    setError(null);
    setActionSuccess(null);
    try {
      await allocationsApi.completeAllocation(allocationId);
      const msg = 'Allocation marked as completed.';
      setActionSuccess(msg);
      toast.success(msg);
      await loadAllocations();
    } catch (err) {
      setError(err);
      toast.error('Failed to complete allocation.');
    }
  };

  return (
    <div className="page-container">
      <PageHeader
        title="My Facility Allocations"
        description="Review active stock holds and fulfilled blood unit dispatches for hospital emergency requests."
        actions={
          <Button variant="secondary" onClick={loadAllocations} icon={<RefreshCw size={14} />}>
            Refresh
          </Button>
        }
      />

      <InfoBanner variant="info">
        <strong>Atomic Stock Restoration:</strong> Releasing a reserved allocation restores units back to your recorded red-cell inventory automatically. Marking completed records formal fulfillment.
      </InfoBanner>

      <ErrorAlert error={error} onRetry={loadAllocations} />
      {actionSuccess && (
        <div className="form-success" role="status">
          <CheckCircle2 size={16} />
          <span>{actionSuccess}</span>
        </div>
      )}

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
  );
}
