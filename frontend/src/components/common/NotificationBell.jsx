import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, Clock } from 'lucide-react';
import { notificationsApi } from '../../api/notifications.api.js';
import { useAuth } from '../../hooks/useAuth.js';
import { usePolling } from '../../hooks/usePolling.js';
import { formatDateTime } from '../../utils/dates.js';

export function NotificationBell() {
  const { authStatus, isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const fetchCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await notificationsApi.getUnreadCount();
      setUnreadCount(data?.unreadCount || 0);
    } catch {
      // Ignore background poll errors
    }
  }, [isAuthenticated]);

  usePolling(fetchCount, 15000, authStatus === 'authenticated');

  useEffect(() => {
    if (authStatus !== 'authenticated') {
      setUnreadCount(0);
      setNotifications([]);
      setIsOpen(false);
    }
  }, [authStatus]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = async () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      setLoading(true);
      try {
        const data = await notificationsApi.getNotifications({ limit: 10 });
        setNotifications(data?.notifications || []);
      } catch {
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleMarkRead = async (id, e) => {
    e.stopPropagation();
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Ignore
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button
        type="button"
        className="notification-bell-btn"
        onClick={handleToggle}
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="notification-count-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-popover">
          <div className="notification-popover-header">
            <h4>System Notifications</h4>
            {unreadCount > 0 && (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-accent-600)', fontWeight: 600 }}>
                {unreadCount} unread
              </span>
            )}
          </div>

          <div className="notification-list-popover">
            {loading ? (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <p style={{ fontSize: 'var(--font-size-sm)' }}>Loading notifications…</p>
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <p style={{ fontSize: 'var(--font-size-sm)' }}>No notifications right now.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`notification-item-popover ${!n.isRead ? 'unread' : ''}`}
                  onClick={(e) => !n.isRead && handleMarkRead(n.id, e)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="notification-item-title">{n.title || 'Notification'}</span>
                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkRead(n.id, e)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-text-muted)',
                          cursor: 'pointer',
                          padding: 2,
                        }}
                        title="Mark as read"
                      >
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                  <p className="notification-item-msg">{n.body || n.message}</p>
                  <span className="notification-item-time">
                    <Clock size={10} style={{ display: 'inline', marginRight: 4 }} />
                    {formatDateTime(n.createdAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
