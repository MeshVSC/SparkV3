import { NotificationData, NotificationDelivery, NotificationChannel, NotificationChannelHandler } from '@/types/notification';

export class PushChannelHandler implements NotificationChannelHandler {
  channel = NotificationChannel.PUSH;

  async send(notification: NotificationData, delivery: NotificationDelivery): Promise<boolean> {
    try {
      // Get user's push subscription tokens
      const pushTokens = await this.getUserPushTokens(notification.userId);
      
      if (pushTokens.length === 0) {
        console.warn(`No push tokens found for user ${notification.userId}`);
        return false;
      }

      // Send push notification to all user's devices
      const results = await Promise.allSettled(
        pushTokens.map(token => this.sendPushToToken(notification, token))
      );

      // Consider successful if at least one push notification was sent
      const successCount = results.filter(result => 
        result.status === 'fulfilled' && result.value
      ).length;

      return successCount > 0;
    } catch (error) {
      console.error('Push notification delivery failed:', error);
      return false;
    }
  }

  private async sendPushToToken(notification: NotificationData, token: PushToken): Promise<boolean> {
    try {
      const pushPayload = this.buildPushPayload(notification);
      
      switch (token.platform) {
        case 'web':
          return await this.sendWebPush(token, pushPayload);
        case 'ios':
          return await this.sendAPNS(token, pushPayload);
        case 'android':
          return await this.sendFCM(token, pushPayload);
        default:
          console.warn(`Unsupported push platform: ${token.platform}`);
          return false;
      }
    } catch (error) {
      console.error(`Failed to send push to token ${token.id}:`, error);
      return false;
    }
  }

  private buildPushPayload(notification: NotificationData): PushPayload {
    return {
      title: notification.title,
      body: notification.message,
      icon: '/icon-192x192.png', // App icon
      badge: '/badge-72x72.png', // Badge icon
      data: {
        notificationId: notification.id,
        type: notification.type,
        userId: notification.userId,
        ...notification.data
      },
      actions: this.buildPushActions(notification),
      tag: `notification-${notification.id}`,
      requireInteraction: notification.priority >= 3, // High priority notifications require interaction
      silent: false,
      timestamp: notification.createdAt.getTime()
    };
  }

  private buildPushActions(notification: NotificationData): PushAction[] {
    const actions: PushAction[] = [
      {
        action: 'view',
        title: 'View',
        icon: '/icons/view.png'
      }
    ];

    // Add context-specific actions based on notification type
    switch (notification.type) {
      case 'collaboration_invite':
        actions.push(
          {
            action: 'accept',
            title: 'Accept',
            icon: '/icons/accept.png'
          },
          {
            action: 'decline',
            title: 'Decline',
            icon: '/icons/decline.png'
          }
        );
        break;
      case 'spark_update':
        actions.push({
          action: 'open_spark',
          title: 'Open Spark',
          icon: '/icons/spark.png'
        });
        break;
    }

    return actions;
  }

  private async sendWebPush(token: PushToken, payload: PushPayload): Promise<boolean> {
    try {
      // In production, use a library like 'web-push'
      // This is a mock implementation
      
      if (process.env.NODE_ENV === 'development') {
        console.log('📱 Mock Web Push Sent:');
        console.log('Token:', token.token.substring(0, 20) + '...');
        console.log('Payload:', { title: payload.title, body: payload.body });
        return true;
      }

      // Example web-push integration (commented out):
      /*
      const webpush = require('web-push');
      
      webpush.setVapidDetails(
        'mailto:your-email@example.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );
      
      const subscription = {
        endpoint: token.endpoint,
        keys: {
          p256dh: token.p256dh,
          auth: token.auth
        }
      };
      
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      return true;
      */

      return true;
    } catch (error) {
      console.error('Web push sending error:', error);
      return false;
    }
  }

  private async sendAPNS(token: PushToken, payload: PushPayload): Promise<boolean> {
    try {
      // In production, use Apple Push Notification service
      // This is a mock implementation
      
      if (process.env.NODE_ENV === 'development') {
        console.log('📱 Mock APNS Push Sent:');
        console.log('Token:', token.token.substring(0, 20) + '...');
        console.log('Payload:', { title: payload.title, body: payload.body });
        return true;
      }

      // Example APNS integration (commented out):
      /*
      const apn = require('apn');
      
      const provider = new apn.Provider({
        token: {
          key: process.env.APNS_KEY_PATH,
          keyId: process.env.APNS_KEY_ID,
          teamId: process.env.APNS_TEAM_ID
        },
        production: process.env.NODE_ENV === 'production'
      });
      
      const notification = new apn.Notification({
        alert: {
          title: payload.title,
          body: payload.body
        },
        badge: 1,
        sound: 'default',
        payload: payload.data,
        topic: process.env.BUNDLE_ID
      });
      
      const result = await provider.send(notification, token.token);
      return result.sent.length > 0;
      */

      return true;
    } catch (error) {
      console.error('APNS sending error:', error);
      return false;
    }
  }

  private async sendFCM(token: PushToken, payload: PushPayload): Promise<boolean> {
    try {
      // In production, use Firebase Cloud Messaging
      // This is a mock implementation
      
      if (process.env.NODE_ENV === 'development') {
        console.log('📱 Mock FCM Push Sent:');
        console.log('Token:', token.token.substring(0, 20) + '...');
        console.log('Payload:', { title: payload.title, body: payload.body });
        return true;
      }

      // Example FCM integration (commented out):
      /*
      const admin = require('firebase-admin');
      
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
          })
        });
      }
      
      const message = {
        token: token.token,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.icon
        },
        data: Object.fromEntries(
          Object.entries(payload.data).map(([key, value]) => [key, String(value)])
        ),
        android: {
          priority: 'high',
          notification: {
            channelId: 'default',
            priority: 'high'
          }
        },
        apns: {
          payload: {
            aps: {
              badge: 1,
              sound: 'default'
            }
          }
        }
      };
      
      const response = await admin.messaging().send(message);
      return !!response;
      */

      return true;
    } catch (error) {
      console.error('FCM sending error:', error);
      return false;
    }
  }

  private async getUserPushTokens(userId: string): Promise<PushToken[]> {
    // In production, this would query the database for user's push tokens
    // For now, return mock tokens
    return [
      {
        id: `token-${userId}-1`,
        userId,
        token: `mock-web-token-${userId}`,
        platform: 'web',
        endpoint: `https://fcm.googleapis.com/fcm/send/${userId}`,
        p256dh: 'mock-p256dh-key',
        auth: 'mock-auth-key',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  validateConfig(config: PushConfig): boolean {
    // Validate push notification configuration
    if (config.web && !config.web.vapidPublicKey) {
      return false;
    }
    
    if (config.ios && (!config.ios.keyId || !config.ios.teamId)) {
      return false;
    }
    
    if (config.android && !config.android.serviceAccountKey) {
      return false;
    }
    
    return true;
  }
}

interface PushToken {
  id: string;
  userId: string;
  token: string;
  platform: 'web' | 'ios' | 'android';
  endpoint?: string; // For web push
  p256dh?: string; // For web push
  auth?: string; // For web push
  createdAt: Date;
  updatedAt: Date;
}

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data: Record<string, any>;
  actions?: PushAction[];
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  timestamp?: number;
}

interface PushAction {
  action: string;
  title: string;
  icon?: string;
}

interface PushConfig {
  web?: {
    vapidPublicKey: string;
    vapidPrivateKey: string;
  };
  ios?: {
    keyId: string;
    teamId: string;
    keyPath: string;
    bundleId: string;
  };
  android?: {
    serviceAccountKey: string;
  };
}