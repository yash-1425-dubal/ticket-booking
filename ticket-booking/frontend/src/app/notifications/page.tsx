'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const [listRes, unreadRes] = await Promise.all([
        api.get<{ success: boolean; data: Notification[] }>('/notifications'),
        api.get<{ success: boolean; data: { count: number } }>('/notifications/unread-count'),
      ]);
      setNotifications(listRes.data);
      setUnreadCount(unreadRes.data.count);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-8"><p>Loading...</p></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          Notifications
          {unreadCount > 0 && (
            <span className="ml-2 text-sm bg-primary text-white px-2 py-0.5 rounded-full">{unreadCount}</span>
          )}
        </h1>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-sm text-primary hover:underline">Mark all as read</button>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className="text-gray-500">No notifications.</p>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`card cursor-pointer ${!n.readAt ? 'border-l-4 border-l-primary' : ''}`}
              onClick={() => !n.readAt && markAsRead(n.id)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-sm">{n.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{n.message}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                  {new Date(n.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
