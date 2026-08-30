import { apiClient } from '../../core/api-client.js';

// Which request the detail page should load (the router has no path params).
let selectedRequestId = null;
export const setSelectedRequestId = (id) => {
  selectedRequestId = id;
};
export const getSelectedRequestId = () => selectedRequestId;

export const hospitalService = {
  get: () => apiClient.get('/hospital/profile'),
  create: (d) => apiClient.post('/hospital/profile', d),
  update: (d) => apiClient.patch('/hospital/profile', d),

  // Module 03 - emergency requests
  createRequest: (d) => apiClient.post('/requests', d),
  listRequests: (status) => apiClient.get(status ? `/requests?status=${encodeURIComponent(status)}` : '/requests'),
  getRequest: (id) => apiClient.get(`/requests/${id}`),
  cancelRequest: (id) => apiClient.post(`/requests/${id}/cancel`, {}),
  completeRequest: (id) => apiClient.post(`/requests/${id}/complete`, {}),
};
