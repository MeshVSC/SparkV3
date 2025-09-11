import { NotificationData, NotificationType } from '@/types/notification';

export interface PushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebPushConfig {
  vapidPublicKey: string;
  vapidPrivateKey?: string;
  subject: string;
}

export class WebPushService {
  private static instance: WebPushService;
  private subscriptions: Map<string, PushSubscription[]> = new Map();
  private config: WebPushConfig;
  private isSupported: boolean;

  private constructor() {
    this.isSupported = this.checkBrowserSupport();
    this.config = {
      vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
      vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
      subject: process.env.NEXT_PUBLIC_APP_URL || 'mailto:support@sparkapp.com'
    };
  }

  static getInstance(): WebPushService {
    if (!WebPushService.instance) {
      WebPushService.instance = new WebPushService();
    }
    return WebPushService.instance;
  }

  /**
   * Check if the browser supports push notifications
   */
  checkBrowserSupport(): boolean {
    if (typeof window === 'undefined') return false;
    
    return !!(
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  /**
   * Get current notification permission status
   */
  getPermissionStatus(): NotificationPermission {
    if (typeof window === 'undefined' || !this.isSupported) {
      return 'denied';
    }
    return Notification.permission;
  }

  /**
   * Request notification permission from user
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      throw new Error('Push notifications are not supported in this browser');
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      throw new Error('Push notifications are blocked. Please enable them in your browser settings.');
    }

    const permission = await Notification.requestPermission();
    
    if (permission !== 'granted') {
      throw new Error('Push notification permission was denied');
    }

    return permission;
  }

  /**
   * Register service worker for push notifications
   */
  async registerServiceWorker(): Promise<ServiceWorkerRegistration> {
    if (!this.isSupported) {
      throw new Error('Service workers are not supported in this browser');
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;

      console.log('Service worker registered for push notifications');
      return registration;
    } catch (error) {
      console.error('Service worker registration failed:', error);
      throw new Error('Failed to register service worker');
    }
  }

  /**
   * Subscribe user to push notifications
   */
  async subscribeUser(userId: string): Promise<PushSubscription> {
    try {
      // Request permission first
      await this.requestPermission();

      // Register service worker
      const registration = await this.registerServiceWorker();

      // Check if already subscribed
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        await existingSubscription.unsubscribe();
      }

      // Create new subscription
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.config.vapidPublicKey)
      });

      const pushSubscription: PushSubscription = {
        id: crypto.randomUUID(),
        userId,
        endpoint: subscription.endpoint,
        p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
        auth: this.arrayBufferToBase64(subscription.getKey('auth')!),
        userAgent: navigator.userAgent,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store subscription
      await this.storeSubscription(pushSubscription);

      console.log('User subscribed to push notifications');
      return pushSubscription;
    } catch (error) {
      console.error('Failed to subscribe user to push notifications:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe user from push notifications
   */
  async unsubscribeUser(userId: string): Promise<void> {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            await subscription.unsubscribe();
          }
        }
      }

      // Remove stored subscriptions
      await this.removeUserSubscriptions(userId);

      console.log('User unsubscribed from push notifications');
    } catch (error) {
      console.error('Failed to unsubscribe user:', error);
      throw error;
    }
  }

  /**
   * Send push notification to user
   */
  async sendPushNotification(
    userId: string,
    notification: Omit<NotificationData, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<boolean> {
    try {
      const subscriptions = await this.getUserSubscriptions(userId);
      
      if (subscriptions.length === 0) {
        console.warn(`No push subscriptions found for user ${userId}`);
        return false;
      }

      const pushPayload = {
        title: notification.title,
        body: notification.message,
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        data: {
          notificationId: crypto.randomUUID(),
          type: notification.type,
          userId: notification.userId,
          url: this.getNotificationUrl(notification),
          ...notification.data
        },
        actions: this.getNotificationActions(notification),
        tag: `notification-${notification.type}-${Date.now()}`,
        requireInteraction: notification.priority >= 3,
        silent: false,
        timestamp: Date.now()
      };

      // Send to all user subscriptions
      const results = await Promise.allSettled(
        subscriptions.map(subscription => 
          this.sendToSubscription(subscription, pushPayload)
        )
      );

      const successCount = results.filter(result => 
        result.status === 'fulfilled' && result.value
      ).length;

      console.log(`Push notification sent to ${successCount}/${subscriptions.length} subscriptions`);
      return successCount > 0;
    } catch (error) {
      console.error('Failed to send push notification:', error);
      return false;
    }
  }

  /**
   * Send push notification for spark updates when app is not in focus
   */
  async sendSparkUpdateNotification(
    userId: string,
    sparkId: string,
    sparkTitle: string,
    updateType: 'content' | 'participant_joined' | 'participant_left'
  ): Promise<void> {
    if (!this.shouldSendNotification(userId)) return;

    const messages = {
      content: `"${sparkTitle}" has been updated`,
      participant_joined: `Someone joined the collaboration on "${sparkTitle}"`,
      participant_left: `Someone left the collaboration on "${sparkTitle}"`
    };

    await this.sendPushNotification(userId, {
      userId,
      type: NotificationType.SPARK_UPDATE,
      title: 'Spark Updated',
      message: messages[updateType],
      priority: 2,
      channels: ['push'],
      data: { sparkId, sparkTitle, updateType }
    });
  }

  /**
   * Send push notification for collaboration events
   */
  async sendCollaborationNotification(
    userId: string,
    event: {
      type: 'user_connected' | 'user_disconnected' | 'operation_conflict';
      sparkId: string;
      sparkTitle: string;
      userName?: string;
      data?: any;
    }
  ): Promise<void> {
    if (!this.shouldSendNotification(userId)) return;

    const titles = {
      user_connected: 'User Joined',
      user_disconnected: 'User Left',
      operation_conflict: 'Collaboration Conflict'
    };

    const messages = {
      user_connected: `${event.userName} joined "${event.sparkTitle}"`,
      user_disconnected: `${event.userName} left "${event.sparkTitle}"`,
      operation_conflict: `Conflicting changes detected in "${event.sparkTitle}"`
    };

    await this.sendPushNotification(userId, {
      userId,
      type: NotificationType.COLLABORATION_ACTION,
      title: titles[event.type],
      message: messages[event.type],
      priority: event.type === 'operation_conflict' ? 3 : 2,
      channels: ['push'],
      data: event
    });
  }

  /**
   * Check if we should send a notification (app not in focus)
   */
  private shouldSendNotification(userId: string): boolean {
    if (typeof document === 'undefined') return true;
    
    // Don't send push notifications if the app is in focus
    return document.hidden || !document.hasFocus();
  }

  /**
   * Get notification URL for click handling
   */
  private getNotificationUrl(notification: NotificationData): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    
    switch (notification.type) {
      case NotificationType.SPARK_UPDATE:
      case NotificationType.COLLABORATION_ACTION:
        return `${baseUrl}/spark/${notification.data?.sparkId}`;
      case NotificationType.ACHIEVEMENT_UNLOCKED:
        return `${baseUrl}/achievements`;
      default:
        return baseUrl;
    }
  }

  /**
   * Get notification actions based on type
   */
  private getNotificationActions(notification: NotificationData): any[] {
    const actions = [{
      action: 'view',
      title: 'View',
      icon: '/icons/view.png'
    }];

    switch (notification.type) {
      case NotificationType.COLLABORATION_INVITE:
        actions.push(
          { action: 'accept', title: 'Accept', icon: '/icons/accept.png' },
          { action: 'decline', title: 'Decline', icon: '/icons/decline.png' }
        );
        break;
      case NotificationType.SPARK_UPDATE:
        actions.push({
          action: 'open_spark',
          title: 'Open Spark',
          icon: '/icons/spark.png'
        });
        break;
    }

    return actions;
  }

  /**
   * Send notification to a specific subscription
   */
  private async sendToSubscription(
    subscription: PushSubscription,
    payload: any
  ): Promise<boolean> {
    try {
      // In production, this would use a proper web-push library
      // For now, we'll use the Web Push API directly
      
      if (process.env.NODE_ENV === 'development') {
        console.log('📱 Mock Push Notification:', {
          endpoint: subscription.endpoint.substring(0, 50) + '...',
          title: payload.title,
          body: payload.body
        });
        return true;
      }

      // In production, implement actual web push sending
      // This would typically be done on the server side
      return true;
    } catch (error) {
      console.error('Failed to send to subscription:', error);
      
      // Remove invalid subscriptions
      if (error instanceof Error && error.message.includes('410')) {
        await this.removeSubscription(subscription.id);
      }
      
      return false;
    }
  }

  /**
   * Store push subscription
   */
  private async storeSubscription(subscription: PushSubscription): Promise<void> {
    const userSubscriptions = this.subscriptions.get(subscription.userId) || [];
    
    // Remove existing subscriptions for this endpoint
    const filtered = userSubscriptions.filter(sub => sub.endpoint !== subscription.endpoint);
    filtered.push(subscription);
    
    this.subscriptions.set(subscription.userId, filtered);

    // In production, persist to database
    try {
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
      });
      
      if (!response.ok) {
        throw new Error('Failed to store subscription on server');
      }
    } catch (error) {
      console.error('Failed to persist subscription:', error);
    }
  }

  /**
   * Get user's push subscriptions
   */
  private async getUserSubscriptions(userId: string): Promise<PushSubscription[]> {
    // First check in-memory cache
    const cached = this.subscriptions.get(userId);
    if (cached && cached.length > 0) {
      return cached;
    }

    // Fetch from server
    try {
      const response = await fetch(`/api/push/subscriptions/${userId}`);
      if (response.ok) {
        const subscriptions = await response.json();
        this.subscriptions.set(userId, subscriptions);
        return subscriptions;
      }
    } catch (error) {
      console.error('Failed to fetch subscriptions:', error);
    }

    return [];
  }

  /**
   * Remove all subscriptions for a user
   */
  private async removeUserSubscriptions(userId: string): Promise<void> {
    this.subscriptions.delete(userId);

    try {
      await fetch(`/api/push/subscriptions/${userId}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Failed to remove user subscriptions:', error);
    }
  }

  /**
   * Remove a specific subscription
   */
  private async removeSubscription(subscriptionId: string): Promise<void> {
    // Remove from in-memory cache
    for (const [userId, subscriptions] of this.subscriptions.entries()) {
      const filtered = subscriptions.filter(sub => sub.id !== subscriptionId);
      if (filtered.length !== subscriptions.length) {
        this.subscriptions.set(userId, filtered);
        break;
      }
    }

    try {
      await fetch(`/api/push/subscription/${subscriptionId}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Failed to remove subscription:', error);
    }
  }

  /**
   * Convert VAPID key from base64 to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}

export const webPushService = WebPushService.getInstance();