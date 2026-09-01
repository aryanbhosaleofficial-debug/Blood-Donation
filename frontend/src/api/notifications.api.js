import { apiClient } from './api-client.js';

export const notificationsApi = {
  getNotifications: (params = {}) => apiClient.get('/notifications', { params }),
  getUnreadCount: () => apiClient.get('/notifications/unread-count'),
  getNotification: (id) => apiClient.get(`/notifications/${id}`),
  markRead: (id) => apiClient.post(`/notifications/${id}/read`),
};
