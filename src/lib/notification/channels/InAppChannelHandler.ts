import { NotificationData, NotificationDelivery, NotificationChannel, NotificationChannelHandler } from '@/types/notification';
// import { socketClient } from '@/lib/socket-client';

export class InAppChannelHandler implements NotificationChannelHandler {
  channel = NotificationChannel.IN_APP;

  async send(notification: NotificationData, delivery: NotificationDelivery): Promise<boolean> {
    try {
      // If socket client is connected, send real-time notification
      // if (socketClient.isConnected()) {
      //   this.sendRealTimeNotification(notification);
      // }

      // Store notification for retrieval when user is offline or on different session
      await this.storeInAppNotification(notification);
      
      return true;
    } catch (error) {
      console.error('InApp notification delivery failed:', error);
      return false;
    }
  }

  // private sendRealTimeNotification(notification: NotificationData): void {
  //   // Emit a custom event for in-app notifications
  //   if (socketClient.getConnectionStatus() === 'connected') {
  //     // Use the existing socket to emit notification event
  //     // This would require extending the socket events to support notifications
  //     const socket = (socketClient as any).socket;
  //     if (socket) {
  //       socket.emit('notification', {
  //         id: notification.id,
  //         type: notification.type,
  //         title: notification.title,
  //         message: notification.message,
  //         data: notification.data,
  //         timestamp: notification.createdAt.toISOString(),
  //         userId: notification.userId
  //       });
  //     }
  //   }
  // }

  private async storeInAppNotification(notification: NotificationData): Promise<void> {
    // In a production app, this would store the notification in a database
    // or in-memory cache for retrieval when the user opens the app
    
    // For now, we'll use localStorage as a simple storage mechanism
    if (typeof window !== 'undefined') {
      try {
        const storageKey = `notifications_${notification.userId}`;
        const existingNotifications = JSON.parse(localStorage.getItem(storageKey) || '[]');
        
        const storedNotification = {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          read: false,
          createdAt: notification.createdAt.toISOString()
        };

        existingNotifications.unshift(storedNotification);
        
        // Keep only the last 100 notifications
        const limitedNotifications = existingNotifications.slice(0, 100);
        
        localStorage.setItem(storageKey, JSON.stringify(limitedNotifications));
      } catch (error) {
        console.warn('Failed to store notification in localStorage:', error);
      }
    }
  }

  validateConfig(config: any): boolean {
    // In-app notifications don't require special configuration
    return true;
  }

  // Helper method to retrieve stored notifications for a user
  static getStoredNotifications(userId: string): any[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const storageKey = `notifications_${userId}`;
      return JSON.parse(localStorage.getItem(storageKey) || '[]');
    } catch (error) {
      console.warn('Failed to retrieve notifications from localStorage:', error);
      return [];
    }
  }

  // Helper method to mark notifications as read
  static markNotificationAsRead(userId: string, notificationId: string): boolean {
    if (typeof window === 'undefined') return false;
    
    try {
      const storageKey = `notifications_${userId}`;
      const notifications = JSON.parse(localStorage.getItem(storageKey) || '[]');
      
      const notificationIndex = notifications.findIndex((n: any) => n.id === notificationId);
      if (notificationIndex !== -1) {
        notifications[notificationIndex].read = true;
        localStorage.setItem(storageKey, JSON.stringify(notifications));
        return true;
      }
      return false;
    } catch (error) {
      console.warn('Failed to mark notification as read:', error);
      return false;
    }
  }

  // Helper method to clear all notifications for a user
  static clearNotifications(userId: string): boolean {
    if (typeof window === 'undefined') return false;
    
    try {
      const storageKey = `notifications_${userId}`;
      localStorage.removeItem(storageKey);
      return true;
    } catch (error) {
      console.warn('Failed to clear notifications:', error);
      return false;
    }
  }
}