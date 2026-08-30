import { apiClient } from './api-client.js';

export const pledgesApi = {
  createPledge: (alertId) => apiClient.post(`/donor/alerts/${alertId}/pledge`, {}),
  getPledges: () => apiClient.get('/donor/pledges'),
  getPledgeDetail: (pledgeId) => apiClient.get(`/donor/pledges/${pledgeId}`),
  cancelPledge: (pledgeId) => apiClient.post(`/donor/pledges/${pledgeId}/cancel`, {}),
  arrivePledge: (pledgeId) => apiClient.post(`/donor/pledges/${pledgeId}/arrive`, {}),
  shareLocation: (pledgeId, coords) => apiClient.post(`/donor/pledges/${pledgeId}/location`, coords),
  stopLocation: (pledgeId) => apiClient.delete(`/donor/pledges/${pledgeId}/location`),
};
