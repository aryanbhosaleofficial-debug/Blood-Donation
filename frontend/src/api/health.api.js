import { apiClient } from './api-client.js';

let inFlightHealthRequest = null;

export const healthApi = {
  getHealth() {
    if (!inFlightHealthRequest) {
      inFlightHealthRequest = apiClient.get('/health').finally(() => {
        inFlightHealthRequest = null;
      });
    }
    return inFlightHealthRequest;
  },
};
