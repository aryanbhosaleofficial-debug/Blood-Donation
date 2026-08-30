import { apiClient } from './api-client.js';

export const adminApi = {
  getPendingOrganizations: () => apiClient.get('/admin/organizations/pending'),
  getVerifiedOrganizations: () => apiClient.get('/admin/organizations/verified'),
  verifyOrganization: (userId) => apiClient.post(`/admin/organizations/${userId}/verify`, {}),
  revokeOrganization: (userId) => apiClient.post(`/admin/organizations/${userId}/revoke`, {}),
};
