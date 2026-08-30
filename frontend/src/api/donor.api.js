import { apiClient } from './api-client.js';

export const donorApi = {
  getProfile: () => apiClient.get('/donor/profile'),
  createProfile: (data) => apiClient.post('/donor/profile', data),
  updateProfile: (data) => apiClient.patch('/donor/profile', data),
  setAvailability: (status) => apiClient.patch('/donor/availability', { status }),
  getAlerts: () => apiClient.get('/donor/alerts'),
  getAlertDetail: (alertId) => apiClient.get(`/donor/alerts/${alertId}`),
  viewAlert: (alertId) => apiClient.post(`/donor/alerts/${alertId}/view`, {}),
  dismissAlert: (alertId) => apiClient.post(`/donor/alerts/${alertId}/dismiss`, {}),
};
