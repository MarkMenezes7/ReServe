import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { notificationsApi } from '../services/api';
import type { Notification } from '../types';
import './NotificationBell.css';

interface NotificationBellProps {
  userId: number;
  socket?: { on: (event: string, cb: (data: unknown) => void) => void; off: (event: string, cb: (data: unknown) => void) => void } | null;
}

export default function NotificationBell({ userId, socket }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadNotifications();
    loadUnreadCount();
  }, [userId]);

  useEffect(() => {
    if (!socket) return;
    const handleNotification = () => {
      loadNotifications();
      loadUnreadCount();
    };
    socket.on('notification', handleNotification);
    return () => { socket.off('notification', handleNotification); };
  }, [socket]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function loadNotifications() {
    try {
      const data = await notificationsApi.get(userId, 10);
      setNotifications(data);
    } catch { /* ignore */ }
  }

  async function loadUnreadCount() {
    try {
      const data = await notificationsApi.getUnreadCount(userId);
      setUnreadCount(data.count);
    } catch { /* ignore */ }
  }

  async function handleMarkRead(id: number) {
    try {
      await notificationsApi.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* ignore */ }
  }

  async function handleMarkAllRead() {
    try {
      await notificationsApi.markAllRead(userId);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: 1 })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  }

  function handleNotificationClick(n: Notification) {
    handleMarkRead(n.id);
    if (n.relatedType === 'chat') {
      navigate('/chat');
    } else if (n.relatedType === 'claim') {
      const userType = localStorage.getItem('userType');
      navigate(userType === 'donor' ? '/donor/dashboard' : '/ngo/dashboard');
    }
    setIsOpen(false);
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  return (
    <div className="notification-bell-wrapper" ref={dropdownRef}>
      <button className="notification-bell-btn" onClick={() => setIsOpen(!isOpen)}>
        <Bell size={20} />
        {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <h4>Notifications</h4>
            {unreadCount > 0 && (
              <button className="notification-mark-all" onClick={handleMarkAllRead}>Mark all read</button>
            )}
          </div>
          <div className="notification-dropdown-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">No notifications yet</div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`notification-item ${n.isRead ? '' : 'notification-unread'}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="notification-item-title">{n.title}</div>
                  <div className="notification-item-message">{n.message}</div>
                  <div className="notification-item-time">{formatTime(n.createdAt)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
