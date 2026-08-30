import { apiClient } from './api-client.js';

export const allocationsApi = {
  getBankAllocations: () => apiClient.get('/blood-bank/allocations'),
  releaseAllocation: (allocationId) => apiClient.post(`/allocations/${allocationId}/release`, {}),
  completeAllocation: (allocationId) => apiClient.post(`/allocations/${allocationId}/complete`, {}),
};
