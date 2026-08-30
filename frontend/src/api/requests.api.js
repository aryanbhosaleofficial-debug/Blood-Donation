import { apiClient } from './api-client.js';

export const requestsApi = {
  // Hospital emergency request management
  createRequest: (data) => apiClient.post('/requests', data),
  listRequests: (status) => apiClient.get(status ? `/requests?status=${encodeURIComponent(status)}` : '/requests'),
  getRequest: (id) => apiClient.get(`/requests/${id}`),
  cancelRequest: (id) => apiClient.post(`/requests/${id}/cancel`, {}),
  completeRequest: (id) => apiClient.post(`/requests/${id}/complete`, {}),
  getRequestAllocations: (id) => apiClient.get(`/requests/${id}/allocations`),
  activateDonorFallback: (id) => apiClient.post(`/requests/${id}/donor-fallback`, {}),
  getRequestPledges: (id) => apiClient.get(`/requests/${id}/pledges`),

  // Blood bank incoming request view and reserve
  getIncomingRequests: () => apiClient.get('/blood-bank/requests'),
  getIncomingRequestDetail: (id) => apiClient.get(`/blood-bank/requests/${id}`),
  allocateRequest: (id) => apiClient.post(`/requests/${id}/allocate`, {}),
};
