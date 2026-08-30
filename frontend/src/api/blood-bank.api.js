import { apiClient } from './api-client.js';

export const bloodBankApi = {
  getProfile: () => apiClient.get('/blood-bank/profile'),
  createProfile: (data) => apiClient.post('/blood-bank/profile', data),
  updateProfile: (data) => apiClient.patch('/blood-bank/profile', data),
  getInventory: () => apiClient.get('/blood-bank/inventory'),
  updateInventory: (id, data) => apiClient.patch(`/blood-bank/inventory/${id}`, data),
};
