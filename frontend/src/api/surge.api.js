import { apiClient } from './api-client.js';

/**
 * Admin surge-detection API (Module 09).
 *
 * "Surge" = an unusual blood-demand pattern inside this platform that deserves
 * human review. It is NOT a disaster prediction. There is no public surge API.
 */
export const surgeApi = {
  getCandidates: (filters = {}) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && v !== '') params.set(k, v);
    }
    const qs = params.toString();
    return apiClient.get(`/admin/surge/candidates${qs ? `?${qs}` : ''}`);
  },
  getCandidate: (id) => apiClient.get(`/admin/surge/candidates/${id}`),
  confirmCandidate: (id, note) => apiClient.post(`/admin/surge/candidates/${id}/confirm`, note ? { note } : {}),
  rejectCandidate: (id, note) => apiClient.post(`/admin/surge/candidates/${id}/reject`, note ? { note } : {}),
  getEvents: (filters = {}) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && v !== '') params.set(k, v);
    }
    const qs = params.toString();
    return apiClient.get(`/admin/surge/events${qs ? `?${qs}` : ''}`);
  },
  getEvent: (id) => apiClient.get(`/admin/surge/events/${id}`),
};
