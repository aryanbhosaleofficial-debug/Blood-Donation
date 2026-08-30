import React, { useState, useEffect, useCallback } from 'react';
import { bloodBankApi } from '../../api/blood-bank.api.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.jsx';
import { formatDateTime } from '../../utils/dates.js';

export function InventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  // Edit state modal / inline form
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
      setNotice('Inventory updated successfully.');
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

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Red-Cell Inventory</h2>
      </div>

      <div className="disclaimer-box">
        Inventory reflects the last recorded update and may differ from physical stock. Final availability and cross-matching are confirmed by blood-bank staff.
      </div>

      <ErrorAlert error={error} onRetry={loadInventory} />
      {notice && <div className="form-error" role="status">{notice}</div>}

      {editingItem && (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'var(--accent)' }}>
          <h3>Edit Stock for {editingItem.bloodGroup} ({editingItem.component})</h3>
          <form onSubmit={handleUpdate}>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="edit-units">Units Available *</label>
                <input
                  id="edit-units"
                  type="number"
                  min="0"
                  step="1"
                  required
                  disabled={updating}
                  value={editUnits}
                  onChange={(e) => setEditUnits(e.target.value)}
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
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={updating}>
                {updating ? 'Saving…' : 'Confirm Adjustment'}
              </button>
              <button type="button" className="btn btn-secondary" disabled={updating} onClick={closeEdit}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Blood Group</th>
              <th>Component</th>
              <th>Units Available</th>
              <th>Last Updated</th>
              <th>Freshness</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {inventory.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', color: 'var(--muted)' }}>
                  No inventory records configured.
                </td>
              </tr>
            ) : (
              inventory.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.bloodGroup}</strong>
                  </td>
                  <td>{item.component}</td>
                  <td>
                    <strong>{item.unitsAvailable}</strong>
                  </td>
                  <td>{formatDateTime(item.updatedAt)}</td>
                  <td>
                    <span
                      className={`status-badge ${
                        item.isStale ? 'status-cancelled' : 'status-open'
                      }`}
                    >
                      {item.isStale ? 'Stale' : 'Fresh'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.85rem' }}
                      onClick={() => openEdit(item)}
                    >
                      Edit
                    </button>
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
