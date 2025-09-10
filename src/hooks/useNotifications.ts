import { useState, useEffect, useCallback } from 'react';
import { InAppChannelHandler } from '@/lib/notification/channels/InAppChannelHandler';

// Fallback socket client if real client is not available
const socketClient = (typeof window !== 'undefined' && (window as any).__socketClient) ? (window as any).__socketClient : {
  on: (_event: string, _handler?: any) => {},
  off: (_event: string, _handler?: any) => {},
  isConnected: () => false,
}

export interface InAppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: string;
}

export interface NotificationHookReturn {
  notifications: InAppNotification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  clearNotification: (notificationId: string) => void;
  clearAllNotifications: () => void;
  isConnected: boolean;
}

export function useNotifications(userId?: string): NotificationHookReturn {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Load stored notifications on mount
  useEffect(() => {
    if (userId) {
      const stored = InAppChannelHandler.getStoredNotifications(userId);
      setNotifications(stored);
    }
  }, [userId]);

  // Setup socket connection and listeners
  useEffect(() => {
    const handleConnectionChange = () => {
      setIsConnected(socketClient.isConnected());
    };

    const handleNotification = (data: {
      id: string;
      type: string;
      title: string;
      message: string;
      data?: Record<string, any>;
      timestamp: string;
    }) => {
      const notification: InAppNotification = {
        id: data.id,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data,
        read: false,
        createdAt: data.timestamp
      };

      setNotifications(prev => [notification, ...prev.slice(0, 99)]); // Keep last 100

      // Store in localStorage
      if (userId && typeof window !== 'undefined') {
        const updated = [notification, ...InAppChannelHandler.getStoredNotifications(userId).slice(0, 99)];
        localStorage.setItem(`notifications_${userId}`, JSON.stringify(updated));
      }

      // Show browser notification if permission granted
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(data.title, {
          body: data.message,
          icon: '/icon-192x192.png',
          tag: data.id
        });
      }
    };

    // Set up socket event listeners
    socketClient.on('connected', handleConnectionChange);
    socketClient.on('disconnect', handleConnectionChange);
    socketClient.on('notification_received', handleNotification);

    // Initial connection status
    handleConnectionChange();

    return () => {
      socketClient.off('connected');
      socketClient.off('disconnect');
      socketClient.off('notification_received');
    };
  }, [userId]);

  const markAsRead = useCallback((notificationId: string) => {
    if (!userId) return;

    setNotifications(prev =>
      prev.map(notification =>
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      )
    );

    InAppChannelHandler.markNotificationAsRead(userId, notificationId);
  }, [userId]);

  const markAllAsRead = useCallback(() => {
    if (!userId) return;

    setNotifications(prev =>
      prev.map(notification => ({ ...notification, read: true }))
    );

    // Update localStorage
    if (typeof window !== 'undefined') {
      const updated = notifications.map(n => ({ ...n, read: true }));
      localStorage.setItem(`notifications_${userId}`, JSON.stringify(updated));
    }
  }, [userId, notifications]);

  const clearNotification = useCallback((notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));

    if (userId && typeof window !== 'undefined') {
      const updated = notifications.filter(n => n.id !== notificationId);
      localStorage.setItem(`notifications_${userId}`, JSON.stringify(updated));
    }
  }, [userId, notifications]);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);

    if (userId) {
      InAppChannelHandler.clearNotifications(userId);
    }
  }, [userId]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAllNotifications,
    isConnected
  };
}

// Hook for requesting notification permissions
export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  return {
    permission,
    requestPermission,
    isSupported: typeof window !== 'undefined' && 'Notification' in window
  };
}
