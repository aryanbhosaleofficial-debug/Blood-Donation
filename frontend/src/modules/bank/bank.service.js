import { apiClient } from '../../core/api-client.js';

let selectedRequestId = null;
export const setSelectedRequestId = (id) => {
  selectedRequestId = id;
};
export const getSelectedRequestId = () => selectedRequestId;

export const bankService = {
  get: () => apiClient.get('/blood-bank/profile'),
  create: (d) => apiClient.post('/blood-bank/profile', d),
  update: (d) => apiClient.patch('/blood-bank/profile', d),
  inventory: () => apiClient.get('/blood-bank/inventory'),
  updateInventory: (id, d) => apiClient.patch(`/blood-bank/inventory/${id}`, d),

  // Module 03 - incoming emergency requests (read-only)
  incomingRequests: () => apiClient.get('/blood-bank/requests'),
  incomingRequest: (id) => apiClient.get(`/blood-bank/requests/${id}`),
};
