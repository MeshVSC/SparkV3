import { Server } from 'socket.io';
import { notificationService } from './NotificationService';
import { NotificationChannel, NotificationPriority, NotificationType } from '@/types/notification';

export class SocketNotificationIntegration {
  private static instance: SocketNotificationIntegration;
  private io: Server | null = null;

  private constructor() {
    this.setupNotificationServiceListeners();
  }

  static getInstance(): SocketNotificationIntegration {
    if (!SocketNotificationIntegration.instance) {
      SocketNotificationIntegration.instance = new SocketNotificationIntegration();
    }
    return SocketNotificationIntegration.instance;
  }

  initialize(io: Server): void {
    this.io = io;
    this.setupSocketEventListeners();
  }

  private setupNotificationServiceListeners(): void {
    // Listen to notification events from the service
    notificationService.on('delivery_completed', ({ notification, delivery }) => {
      if (delivery.channel === NotificationChannel.IN_APP && delivery.status === 'delivered') {
        this.broadcastNotificationToUser(notification.userId, {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          priority: notification.priority,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Listen to system events that should trigger notifications
    notificationService.on('notification_event', (event) => {
      console.log('Notification event received:', event.type, event.userId);
    });
  }

  private setupSocketEventListeners(): void {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      console.log('Notification integration: Socket connected', socket.id);

      // Listen for spark-related events that should trigger notifications
      socket.on('spark_content_change', (data) => {
        this.handleSparkContentChange(socket, data);
      });

      socket.on('collaboration_invite_sent', (data) => {
        this.handleCollaborationInvite(socket, data);
      });

      socket.on('achievement_unlocked', (data) => {
        this.handleAchievementUnlocked(socket, data);
      });

      // Enhanced notification handlers
      socket.on('notification_request', async (data: {
        targetUserId?: string;
        workspaceId?: string;
        type: string;
        title: string;
        message: string;
        priority?: 'low' | 'medium' | 'high' | 'urgent';
        data?: Record<string, any>;
      }) => {
        const userId = (socket as any).userId;
        if (!userId) return;

        if (data.targetUserId) {
          // Send to specific user
          await this.createImmediateNotification(
            data.targetUserId,
            data.type as any,
            data.title,
            data.message,
            ['in_app'],
            data.priority as any || 'medium',
            data.data
          );
        } else if (data.workspaceId) {
          // Send to workspace
          this.broadcastNotificationToWorkspace(data.workspaceId, {
            type: data.type,
            title: data.title,
            message: data.message,
            priority: data.priority || 'medium',
            data: data.data,
            senderId: userId
          });
        }
      });

      // Handle notification acknowledgments with enhanced tracking
      socket.on('notification_acknowledged', (data: { notificationId: string; userId: string }) => {
        console.log('Notification acknowledged:', data.notificationId, 'by user:', data.userId);
        
        // Update notification delivery status if using the notification service
        notificationService.updateDeliveryStatus(data.notificationId, 'acknowledged');
        
        // Emit acknowledgment event for analytics
        notificationService.emitEvent('notification_acknowledged', data.userId, {
          notificationId: data.notificationId,
          acknowledgedAt: new Date().toISOString()
        });
      });

      // Handle user status updates for targeted notifications
      socket.on('user_status_change', (data: { status: 'online' | 'away' | 'busy' | 'offline' }) => {
        const userId = (socket as any).userId;
        if (!userId) return;

        // Notify notification service about user status change
        notificationService.emitEvent('user_status_changed', userId, {
          status: data.status,
          timestamp: new Date().toISOString()
        });
      });

      socket.on('disconnect', () => {
        console.log('Notification integration: Socket disconnected', socket.id);
      });
    });
  }

  private async handleSparkContentChange(socket: any, data: {
    sparkId: string;
    content: string;
    changeType: string;
    userId: string;
    username: string;
    sparkTitle?: string;
  }): Promise<void> {
    // Only trigger notifications for significant changes
    const significantChanges = ['status', 'title'];
    if (!significantChanges.includes(data.changeType)) {
      return;
    }

    await notificationService.emitEvent('spark_updated', data.userId, {
      sparkId: data.sparkId,
      sparkTitle: data.sparkTitle || `Spark ${data.sparkId}`,
      changeType: data.changeType,
      content: data.content,
      username: data.username
    });
  }

  private async handleCollaborationInvite(socket: any, data: {
    sparkId: string;
    sparkTitle: string;
    inviterId: string;
    inviterName: string;
    invitedUserId: string;
  }): Promise<void> {
    await notificationService.emitEvent('collaboration_invite', data.invitedUserId, {
      sparkId: data.sparkId,
      sparkTitle: data.sparkTitle,
      inviterId: data.inviterId,
      inviterName: data.inviterName
    });
  }

  private async handleAchievementUnlocked(socket: any, data: {
    userId: string;
    achievementId: string;
    achievementName: string;
  }): Promise<void> {
    await notificationService.emitEvent('achievement_unlocked', data.userId, {
      achievementId: data.achievementId,
      achievementName: data.achievementName
    });
  }

  // Method to broadcast notifications to specific users via Socket.IO
  private broadcastNotificationToUser(userId: string, notification: any): void {
    if (!this.io) return;

    // Use the enhanced notification service from socket.ts
    if ((this.io as any).notificationService) {
      (this.io as any).notificationService.sendToUser(userId, {
        id: notification.id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: notification.type || 'general',
        title: notification.title,
        message: notification.message,
        userId: userId,
        data: notification.data,
        priority: notification.priority || 'medium',
        channels: ['in_app'],
        timestamp: notification.timestamp || new Date().toISOString()
      });
    } else {
      // Fallback to room-based approach
      this.io.to(`user_${userId}`).emit('notification_received', notification);
    }
  }

  // Method to broadcast notifications to workspace rooms
  broadcastNotificationToWorkspace(workspaceId: string, notification: any): void {
    if (!this.io) return;

    // Use the enhanced notification service from socket.ts if available
    if ((this.io as any).notificationService) {
      (this.io as any).notificationService.sendToWorkspace(workspaceId, {
        id: notification.id || `workspace_notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: notification.type || 'workspace',
        title: notification.title,
        message: notification.message,
        userId: 'system',
        data: { ...notification.data, workspaceId },
        priority: notification.priority || 'medium',
        channels: ['in_app'],
        timestamp: notification.timestamp || new Date().toISOString()
      });
    } else {
      // Fallback to room-based approach
      const roomKey = `workspace_${workspaceId}`;
      this.io.to(roomKey).emit('notification_received', notification);
    }
  }

  // Helper method to trigger notifications programmatically
  async triggerSparkUpdate(sparkId: string, userId: string, sparkTitle: string, changeType: string): Promise<void> {
    await notificationService.emitEvent('spark_updated', userId, {
      sparkId,
      sparkTitle,
      changeType
    });
  }

  async triggerAchievementUnlocked(userId: string, achievementId: string, achievementName: string): Promise<void> {
    await notificationService.emitEvent('achievement_unlocked', userId, {
      achievementId,
      achievementName
    });
  }

  async triggerCollaborationAction(userId: string, sparkId: string, sparkTitle: string, userName: string, action: string): Promise<void> {
    await notificationService.emitEvent('collaboration_action', userId, {
      sparkId,
      sparkTitle,
      userId,
      userName,
      action
    });
  }

  // Utility method to create immediate notifications
  async createImmediateNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    channels: NotificationChannel[] = [NotificationChannel.IN_APP],
    priority: NotificationPriority = NotificationPriority.MEDIUM,
    data?: Record<string, any>
  ): Promise<string> {
    return notificationService.createNotification({
      userId,
      type,
      title,
      message,
      channels,
      priority,
      data
    });
  }

  // Comment system specific methods
  broadcastToEntity(entityId: string, entityType: string, event: string, data: any): void {
    if (!this.io) return;

    const entityRoom = `entity_${entityType}_${entityId}`;
    this.io.to(entityRoom).emit(event, data);
    console.log(`Broadcasting ${event} to entity room: ${entityRoom}`);
  }

  notifyUser(userId: string, event: string, data: any): void {
    if (!this.io) return;

    // Find all sockets for this user
    this.io.sockets.sockets.forEach((socket) => {
      const socketUserId = (socket as any).userId;
      if (socketUserId === userId) {
        socket.emit(event, data);
      }
    });
  }

  broadcastToWorkspace(workspaceId: string, event: string, data: any): void {
    if (!this.io) return;
    this.io.to(`workspace_${workspaceId}`).emit(event, data);
  }
}

export const socketNotificationIntegration = SocketNotificationIntegration.getInstance();