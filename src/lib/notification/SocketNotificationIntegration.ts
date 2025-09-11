import { Server, Socket } from 'socket.io';
import { notificationService } from './NotificationService';
import { webPushService } from './WebPushService';
import { NotificationChannel, NotificationPriority, NotificationType } from '@/types/notification';

export class SocketNotificationIntegration {
  private static instance: SocketNotificationIntegration;
  private io: Server | null = null;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  private userSessions: Map<string, string> = new Map(); // socketId -> userId
  private userActivity: Map<string, Date> = new Map(); // userId -> last activity timestamp

  private constructor() {
    this.setupNotificationServiceListeners();
    this.startPresenceCleanup();
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

    // Listen to system events that should trigger notifications and push notifications
    notificationService.on('notification_event', async (event) => {
      console.log('Notification event received:', event.type, event.userId);
      
      // Consider push notification for inactive users
      await this.considerPushNotification(event);
    });

    // Listen for notification queued events for real-time delivery
    notificationService.on('notification_queued', ({ notification }) => {
      if (notification.channels.includes(NotificationChannel.IN_APP)) {
        this.sendRealTimeNotification(notification);
      }
    });
  }

  /**
   * Send real-time notification to connected user
   */
  private async sendRealTimeNotification(notification: any): Promise<void> {
    const userSockets = this.connectedUsers.get(notification.userId);
    
    if (!userSockets || userSockets.size === 0) {
      console.log(`User ${notification.userId} not connected, skipping real-time notification`);
      return;
    }

    // Send to user's room
    if (this.io) {
      this.io.to(`user_${notification.userId}`).emit('notification', {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        data: notification.data,
        timestamp: notification.createdAt
      });

      console.log(`Real-time notification sent to user ${notification.userId}`);
    }
  }

  private setupSocketEventListeners(): void {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      console.log('Notification integration: Socket connected', socket.id);

      // Handle user authentication for notifications
      socket.on('auth_user', async (data: { token?: string; userId?: string }) => {
        await this.handleUserAuth(socket, data);
      });

      // Handle user activity tracking
      socket.on('user_activity', () => {
        this.handleUserActivity(socket);
      });

      // Handle notification acknowledgments
      socket.on('notification_ack', (data: { notificationId: string }) => {
        this.handleNotificationAck(socket, data);
      });

      // Handle notification interactions
      socket.on('notification_interact', (data: { 
        notificationId: string; 
        action: string;
        data?: any;
      }) => {
        this.handleNotificationInteraction(socket, data);
      });

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
            [NotificationChannel.IN_APP],
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
        // notificationService.updateDeliveryStatus(data.notificationId, 'acknowledged');
        
        // Emit acknowledgment event for analytics
        // notificationService.emitEvent('notification_acknowledged', data.userId, {
        //   notificationId: data.notificationId,
        //   acknowledgedAt: new Date().toISOString()
        // });
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
        this.handleUserDisconnect(socket);
      });
    });
  }

  /**
   * Handle user authentication for notifications
   */
  private async handleUserAuth(socket: Socket, data: { token?: string; userId?: string }): Promise<void> {
    try {
      let userId: string | undefined;

      if (data.userId) {
        userId = data.userId;
      }

      if (!userId) {
        socket.emit('auth_error', { message: 'Authentication failed' });
        return;
      }

      // Track user connection
      this.trackUserConnection(userId, socket.id);
      this.userActivity.set(userId, new Date());

      // Join user-specific room
      socket.join(`user_${userId}`);

      // Send pending notifications
      await this.sendPendingNotifications(userId, socket);

      socket.emit('auth_success', { userId });
      console.log(`User ${userId} authenticated on socket ${socket.id}`);

    } catch (error) {
      console.error('Authentication error:', error);
      socket.emit('auth_error', { message: 'Authentication failed' });
    }
  }

  /**
   * Track user connection
   */
  private trackUserConnection(userId: string, socketId: string): void {
    // Add to user connections
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)!.add(socketId);

    // Map socket to user
    this.userSessions.set(socketId, userId);

    console.log(`User ${userId} connected (${this.connectedUsers.get(userId)!.size} active sessions)`);
  }

  /**
   * Handle user disconnect
   */
  private handleUserDisconnect(socket: Socket): void {
    const userId = this.userSessions.get(socket.id);
    if (!userId) return;

    // Remove from user connections
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        this.connectedUsers.delete(userId);
        console.log(`User ${userId} fully disconnected`);
      }
    }

    // Remove socket mapping
    this.userSessions.delete(socket.id);

    console.log(`Socket ${socket.id} (user: ${userId}) disconnected`);
  }

  /**
   * Handle user activity tracking
   */
  private handleUserActivity(socket: Socket): void {
    const userId = this.userSessions.get(socket.id);
    if (userId) {
      this.userActivity.set(userId, new Date());
    }
  }

  /**
   * Handle notification acknowledgment
   */
  private handleNotificationAck(socket: Socket, data: { notificationId: string }): void {
    const userId = this.userSessions.get(socket.id);
    if (!userId) return;

    console.log(`Notification ${data.notificationId} acknowledged by user ${userId}`);
    this.userActivity.set(userId, new Date());
  }

  /**
   * Handle notification interaction
   */
  private async handleNotificationInteraction(socket: Socket, data: {
    notificationId: string;
    action: string;
    data?: any;
  }): Promise<void> {
    const userId = this.userSessions.get(socket.id);
    if (!userId) return;

    console.log(`Notification ${data.notificationId} interaction: ${data.action} by user ${userId}`);

    // Handle specific actions
    switch (data.action) {
      case 'dismiss':
        break;
      case 'click':
        break;
      case 'accept':
        await this.handleCollaborationInviteAccept(data.notificationId, userId, socket);
        break;
      case 'decline':
        await this.handleCollaborationInviteDecline(data.notificationId, userId, socket);
        break;
    }

    this.userActivity.set(userId, new Date());
  }

  /**
   * Send pending notifications to newly connected user
   */
  private async sendPendingNotifications(userId: string, socket: Socket): Promise<void> {
    try {
      // In production, this would fetch unread notifications from database
      console.log(`Checking for pending notifications for user ${userId}`);
    } catch (error) {
      console.error('Failed to send pending notifications:', error);
    }
  }

  /**
   * Handle collaboration invite acceptance
   */
  private async handleCollaborationInviteAccept(notificationId: string, userId: string, socket: Socket): Promise<void> {
    try {
      console.log(`User ${userId} accepted collaboration invite ${notificationId}`);
      
      socket.emit('collaboration_invite_accepted', {
        notificationId,
        status: 'accepted'
      });
    } catch (error) {
      console.error('Failed to handle collaboration invite acceptance:', error);
    }
  }

  /**
   * Handle collaboration invite decline
   */
  private async handleCollaborationInviteDecline(notificationId: string, userId: string, socket: Socket): Promise<void> {
    try {
      console.log(`User ${userId} declined collaboration invite ${notificationId}`);
      
      socket.emit('collaboration_invite_declined', {
        notificationId,
        status: 'declined'
      });
    } catch (error) {
      console.error('Failed to handle collaboration invite decline:', error);
    }
  }

  /**
   * Check if user is actively connected
   */
  public isUserActivelyConnected(userId: string): boolean {
    const userSockets = this.connectedUsers.get(userId);
    if (!userSockets || userSockets.size === 0) return false;

    // Check if user has been active recently (within 5 minutes)
    const lastActivity = this.userActivity.get(userId);
    if (!lastActivity) return false;

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return lastActivity > fiveMinutesAgo;
  }

  /**
   * Consider sending push notification for inactive users
   */
  private async considerPushNotification(event: {
    type: string;
    userId: string;
    data: Record<string, any>;
  }): Promise<void> {
    // Only send push notifications for important events when user is inactive
    const importantEvents = ['spark_updated', 'achievement_unlocked', 'collaboration_invite'];
    
    if (!importantEvents.includes(event.type)) return;
    if (this.isUserActivelyConnected(event.userId)) return;

    // Send push notification based on event type
    switch (event.type) {
      case 'spark_updated':
        await webPushService.sendSparkUpdateNotification(
          event.userId,
          event.data.sparkId,
          event.data.sparkTitle,
          'content'
        );
        break;
      
      case 'collaboration_invite':
        await webPushService.sendPushNotification(event.userId, {
          userId: event.userId,
          type: NotificationType.COLLABORATION_INVITE,
          title: 'Collaboration Invite',
          message: `${event.data.inviterName} invited you to collaborate`,
          priority: NotificationPriority.HIGH,
          channels: [NotificationChannel.PUSH],
          data: event.data
        });
        break;
    }
  }

  /**
   * Start cleanup process for inactive connections
   */
  private startPresenceCleanup(): void {
    setInterval(() => {
      const now = new Date();
      const inactivityThreshold = 30 * 60 * 1000; // 30 minutes

      for (const [userId, lastActivity] of this.userActivity.entries()) {
        if (now.getTime() - lastActivity.getTime() > inactivityThreshold) {
          this.userActivity.delete(userId);
          
          const userSockets = this.connectedUsers.get(userId);
          if (!userSockets || userSockets.size === 0) {
            this.connectedUsers.delete(userId);
          }
        }
      }
    }, 10 * 60 * 1000); // Run every 10 minutes
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
        channels: [NotificationChannel.IN_APP],
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
        channels: [NotificationChannel.IN_APP],
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

  /**
   * Get connected users
   */
  getConnectedUsers(): { userId: string; socketCount: number; lastActivity?: Date }[] {
    return Array.from(this.connectedUsers.entries()).map(([userId, sockets]) => ({
      userId,
      socketCount: sockets.size,
      lastActivity: this.userActivity.get(userId)
    }));
  }

  /**
   * Get user connection status
   */
  getUserConnectionStatus(userId: string): {
    connected: boolean;
    socketCount: number;
    lastActivity?: Date;
  } {
    const sockets = this.connectedUsers.get(userId);
    return {
      connected: Boolean(sockets && sockets.size > 0),
      socketCount: sockets ? sockets.size : 0,
      lastActivity: this.userActivity.get(userId)
    };
  }

  /**
   * Shutdown integration and cleanup
   */
  shutdown(): void {
    this.connectedUsers.clear();
    this.userSessions.clear();
    this.userActivity.clear();
    console.log('Socket notification integration shut down');
  }
}

export const socketNotificationIntegration = SocketNotificationIntegration.getInstance();