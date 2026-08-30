import { apiClient } from './api-client.js';

export const authApi = {
  getMe: () => apiClient.get('/auth/me'),
  getCsrfToken: () => apiClient.get('/auth/csrf-token'),
  login: (credentials) => apiClient.post('/auth/login', credentials),
  logout: () => apiClient.post('/auth/logout', {}),
};
