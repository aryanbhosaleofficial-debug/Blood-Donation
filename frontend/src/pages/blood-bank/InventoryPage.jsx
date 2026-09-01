import React, { useState, useEffect, useCallback } from 'react';
import { bloodBankApi } from '../../api/blood-bank.api.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { BloodGroupBadge } from '../../components/common/BloodGroupBadge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { InfoBanner } from '../../components/common/InfoBanner.jsx';
import { Modal } from '../../components/common/Modal.jsx';
import { formatDateTime } from '../../utils/dates.js';
import { Package, Edit2, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useToast } from '../../components/common/ToastContext.jsx';

export function InventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const toast = useToast();

  // Edit state modal
  const [editingItem, setEditingItem] = useState(null);
  const [editUnits, setEditUnits] = useState('');
  const [editReason, setEditReason] = useState('Manual stock recount');
  const [updating, setUpdating] = useState(false);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await bloodBankApi.getInventory();
      if (data && Array.isArray(data.inventory)) {
        setInventory(data.inventory);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const openEdit = (item) => {
    setEditingItem(item);
    setEditUnits(String(item.unitsAvailable));
    setEditReason('Manual stock recount');
    setNotice(null);
  };

  const closeEdit = () => {
    setEditingItem(null);
    setEditUnits('');
    setEditReason('Manual stock recount');
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingItem) return;

    const units = Number(editUnits);
    if (!Number.isInteger(units) || units < 0) {
      setNotice('Units must be a non-negative integer.');
      return;
    }

    setUpdating(true);
    setNotice(null);

    try {
      await bloodBankApi.updateInventory(editingItem.id, {
        unitsAvailable: units,
        expectedVersion: editingItem.version,
        reason: editReason.trim() || 'Manual stock recount',
      });
      closeEdit();
      await loadInventory();
      toast.success('Inventory updated successfully.');
    } catch (err) {
      if (err && err.code === 'INVENTORY_VERSION_CONFLICT') {
        setNotice('Inventory changed in another session. Current values were reloaded.');
        closeEdit();
        await loadInventory();
      } else {
        setNotice(err.message || 'Failed to update inventory.');
      }
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading inventory…" />;
  }

  const totalUnits = inventory.reduce((sum, item) => sum + (item.unitsAvailable || 0), 0);
  const staleCount = inventory.filter((item) => item.isStale).length;

  return (
    <div className="page-container">
      <PageHeader
        title="Red-Cell Inventory Matrix"
        description="Maintain recorded red-cell stock levels across blood groups. Versioned concurrency protects against conflicting multi-operator edits."
        actions={
          <Button variant="secondary" onClick={loadInventory} icon={<RefreshCw size={14} />}>
            Refresh Stock
          </Button>
        }
      />

      <InfoBanner variant="info">
        <strong>Recorded Stock Notice:</strong> Recorded inventory reflects the latest log and may differ from physical cold-storage stock. Physical availability and compatibility testing are confirmed by blood-bank staff before dispatch.
      </InfoBanner>

      <ErrorAlert error={error} onRetry={loadInventory} />
      {notice && (
        <div className="form-error" role="status" style={{ marginBottom: 'var(--space-4)' }}>
          <AlertCircle size={16} />
          <span>{notice}</span>
        </div>
      )}

      {/* Stock Edit Modal */}
      <Modal
        isOpen={Boolean(editingItem)}
        onClose={closeEdit}
        title={editingItem ? `Adjust Stock: ${editingItem.bloodGroup} (${editingItem.component})` : 'Adjust Stock'}
        footer={
          <>
            <Button variant="secondary" onClick={closeEdit} disabled={updating}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleUpdate}
              loading={updating}
            >
              Confirm Adjustment
            </Button>
          </>
        }
      >
        {editingItem && (
          <form onSubmit={handleUpdate}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-md)' }}>
                <BloodGroupBadge bloodGroup={editingItem.bloodGroup} size="lg" />
                <div>
                  <strong style={{ display: 'block', fontSize: 'var(--font-size-base)' }}>
                    Current Recorded Stock: {editingItem.unitsAvailable} units
                  </strong>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    Version #{editingItem.version} · Last updated {formatDateTime(editingItem.updatedAt)}
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="edit-units">New Available Quantity (Units) *</label>
                <input
                  id="edit-units"
                  type="number"
                  min="0"
                  step="1"
                  required
                  disabled={updating}
                  value={editUnits}
                  onChange={(e) => setEditUnits(e.target.value)}
                  style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-reason">Reason for Adjustment *</label>
                <input
                  id="edit-reason"
                  type="text"
                  required
                  disabled={updating}
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="e.g. Manual stock recount, donation batch added"
                />
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Inventory Table */}
      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Blood Group</th>
              <th>Component</th>
              <th>Available Stock</th>
              <th>Freshness</th>
              <th>Last Updated</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {inventory.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-8)' }}>
                  No red-cell inventory records configured for this facility.
                </td>
              </tr>
            ) : (
              inventory.map((item) => (
                <tr key={item.id}>
                  <td>
                    <BloodGroupBadge bloodGroup={item.bloodGroup} />
                  </td>
                  <td>
                    <span style={{ fontWeight: 500 }}>{item.component}</span>
                  </td>
                  <td>
                    <strong style={{ fontSize: 'var(--font-size-lg)', color: item.unitsAvailable === 0 ? 'var(--color-error)' : 'var(--color-text-primary)' }}>
                      {item.unitsAvailable}
                    </strong>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginLeft: 4 }}>
                      {item.unitsAvailable === 1 ? 'unit' : 'units'}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${item.isStale ? 'status-stale' : 'status-open'}`}>
                      {item.isStale ? 'Stale' : 'Fresh'}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      {formatDateTime(item.updatedAt)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openEdit(item)}
                      icon={<Edit2 size={13} />}
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
