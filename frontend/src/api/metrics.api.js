import { apiClient } from './api-client.js';

/**
 * Admin operational metrics API (Module 08).
 * Read-only; ADMIN session required by the backend.
 */
export const metricsApi = {
  getMetrics: () => apiClient.get('/admin/metrics'),
};
