import { apiClient } from './api-client.js';

export const hospitalApi = {
  getProfile: () => apiClient.get('/hospital/profile'),
  createProfile: (data) => apiClient.post('/hospital/profile', data),
  updateProfile: (data) => apiClient.patch('/hospital/profile', data),
};
