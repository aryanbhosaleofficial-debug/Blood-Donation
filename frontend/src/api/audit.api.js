import { apiClient } from './api-client.js';

/**
 * Admin audit-log API (Module 08).
 * Read-only; ADMIN session required by the backend. Audit rows are append-only,
 * so there are deliberately no create / update / delete methods here.
 */
export const auditApi = {
  /**
   * @param {object} [filters] - { action, entityType, entityId, actorUserId, from, to, limit, offset }
   */
  getAuditLogs: (filters = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, value);
      }
    }
    const qs = params.toString();
    return apiClient.get(`/admin/audit-logs${qs ? `?${qs}` : ''}`);
  },
};
