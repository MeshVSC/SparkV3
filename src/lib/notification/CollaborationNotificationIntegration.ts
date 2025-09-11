import { CollaborativeEditingService } from '@/lib/collaborative-editing/CollaborativeEditingService';
import { NotificationService } from './NotificationService';
import { webPushService } from './WebPushService';
import { Operation, OperationType, ParticipantInfo } from '@/types/collaborative-editing';
import { NotificationType, NotificationPriority, NotificationChannel } from '@/types/notification';

/**
 * Integration between collaborative editing and notification systems
 * Handles real-time notifications for collaboration events
 */
export class CollaborationNotificationIntegration {
  private collaborationService: CollaborativeEditingService;
  private notificationService: NotificationService;
  private activeUsers: Map<string, Set<string>> = new Map(); // sparkId -> Set of userIds

  constructor(collaborationService: CollaborativeEditingService) {
    this.collaborationService = collaborationService;
    this.notificationService = NotificationService.getInstance();
    this.setupEventListeners();
  }

  /**
   * Type guard: check if the collaboration service supports EventEmitter-style `on`
   */
  private hasOn(obj: any): obj is { on: (event: string, listener: (...args: any[]) => void) => void } {
    return obj && typeof (obj as any).on === 'function';
  }

  /**
   * Set up event listeners for collaboration events
   */
  private setupEventListeners(): void {
    const svc: any = this.collaborationService as any;

    if (!this.hasOn(svc)) {
      console.warn('CollaborativeEditingService does not implement on(); skipping event subscriptions');
      // Still start periodic cleanup to avoid leaking sessions
      this.startCleanup();
      return;
    }

    // Listen for collaboration events from the service
    svc.on('participant_joined', this.handleParticipantJoined.bind(this));
    svc.on('participant_left', this.handleParticipantLeft.bind(this));
    svc.on('operation_applied', this.handleOperationApplied.bind(this));
    svc.on('conflict_resolved', this.handleConflictResolved.bind(this));
    svc.on('document_updated', this.handleDocumentUpdated.bind(this));

    // Set up periodic cleanup
    this.startCleanup();
  }

  /**
   * Handle participant joining a collaboration session
   */
  private async handleParticipantJoined(data: {
    sparkId: string;
    participant: ParticipantInfo;
    sessionParticipants: ParticipantInfo[];
  }): Promise<void> {
    const { sparkId, participant, sessionParticipants } = data;

    // Track active user
    if (!this.activeUsers.has(sparkId)) {
      this.activeUsers.set(sparkId, new Set());
    }
    this.activeUsers.get(sparkId)!.add(participant.userId);

    // Get spark info for notifications
    const sparkInfo = await this.getSparkInfo(sparkId);
    if (!sparkInfo) return;

    // Notify other participants about new user joining
    const otherParticipants = sessionParticipants.filter(p => p.userId !== participant.userId);

    for (const otherParticipant of otherParticipants) {
      // Send in-app notification
      await this.notificationService.emitEvent('collaboration_action', otherParticipant.userId, {
        type: 'user_joined',
        sparkId,
        sparkTitle: sparkInfo.title,
        userName: participant.username,
        userId: participant.userId,
        action: 'joined the collaboration'
      });

      // Send push notification if user preferences allow and app is not focused
      await webPushService.sendCollaborationNotification(otherParticipant.userId, {
        type: 'user_connected',
        sparkId,
        sparkTitle: sparkInfo.title,
        userName: participant.username
      });
    }

    console.log(`Collaboration notifications sent for user ${participant.username} joining spark ${sparkId}`);
  }

  /**
   * Handle participant leaving a collaboration session
   */
  private async handleParticipantLeft(data: {
    sparkId: string;
    participant: ParticipantInfo;
    sessionParticipants: ParticipantInfo[];
  }): Promise<void> {
    const { sparkId, participant, sessionParticipants } = data;

    // Remove from active users
    const activeSparkUsers = this.activeUsers.get(sparkId);
    if (activeSparkUsers) {
      activeSparkUsers.delete(participant.userId);
      if (activeSparkUsers.size === 0) {
        this.activeUsers.delete(sparkId);
      }
    }

    // Get spark info for notifications
    const sparkInfo = await this.getSparkInfo(sparkId);
    if (!sparkInfo) return;

    // Notify remaining participants
    for (const otherParticipant of sessionParticipants) {
      await this.notificationService.emitEvent('collaboration_action', otherParticipant.userId, {
        type: 'user_left',
        sparkId,
        sparkTitle: sparkInfo.title,
        userName: participant.username,
        userId: participant.userId,
        action: 'left the collaboration'
      });

      // Send push notification
      await webPushService.sendCollaborationNotification(otherParticipant.userId, {
        type: 'user_disconnected',
        sparkId,
        sparkTitle: sparkInfo.title,
        userName: participant.username
      });
    }

    console.log(`Collaboration notifications sent for user ${participant.username} leaving spark ${sparkId}`);
  }

  /**
   * Handle operation being applied in collaboration
   */
  private async handleOperationApplied(data: {
    operation: Operation;
    sessionParticipants: ParticipantInfo[];
  }): Promise<void> {
    const { operation, sessionParticipants } = data;

    // Get spark info
    const sparkInfo = await this.getSparkInfo(operation.sparkId);
    if (!sparkInfo) return;

    // Get operation author info
    const author = sessionParticipants.find(p => p.userId === operation.userId);
    if (!author) return;

    // Generate activity description
    const activityDescription = this.getOperationDescription(operation);
    if (!activityDescription) return;

    // Notify other participants (excluding the operation author)
    const otherParticipants = sessionParticipants.filter(p => p.userId !== operation.userId);

    for (const participant of otherParticipants) {
      // Send real-time in-app notification for significant changes
      if (this.isSignificantOperation(operation)) {
        await this.notificationService.emitEvent('spark_updated', participant.userId, {
          sparkId: operation.sparkId,
          sparkTitle: sparkInfo.title,
          updateType: 'collaborative_edit',
          authorName: author.username,
          action: activityDescription
        });

        // Send push notification for content changes when app is not focused
        await webPushService.sendSparkUpdateNotification(
          participant.userId,
          operation.sparkId,
          sparkInfo.title,
          'content'
        );
      }
    }

    // Track user activity
    await this.trackUserActivity(operation.userId, operation.sparkId, activityDescription);
  }

  /**
   * Handle conflict resolution in collaboration
   */
  private async handleConflictResolved(data: {
    sparkId: string;
    conflictingOperations: Operation[];
    resolution: { strategy: string };
    sessionParticipants: ParticipantInfo[];
  }): Promise<void> {
    const { sparkId, conflictingOperations, sessionParticipants } = data;

    // Get spark info
    const sparkInfo = await this.getSparkInfo(sparkId);
    if (!sparkInfo) return;

    // Notify all participants about conflict resolution
    for (const participant of sessionParticipants) {
      await this.notificationService.createNotification({
        userId: participant.userId,
        type: NotificationType.COLLABORATION_ACTION,
        title: 'Collaboration Conflict Resolved',
        message: `Conflicting changes in "${sparkInfo.title}" have been automatically resolved`,
        channels: [NotificationChannel.IN_APP],
        priority: NotificationPriority.MEDIUM,
        data: {
          sparkId,
          sparkTitle: sparkInfo.title,
          conflictCount: conflictingOperations.length,
          resolutionType: data.resolution.strategy
        }
      });

      // Send push notification for conflicts
      await webPushService.sendCollaborationNotification(participant.userId, {
        type: 'operation_conflict',
        sparkId,
        sparkTitle: sparkInfo.title,
        data: { conflictCount: conflictingOperations.length }
      });
    }

    console.log(`Conflict resolution notifications sent for spark ${sparkId}`);
  }

  /**
   * Handle document update events
   */
  private async handleDocumentUpdated(data: {
    sparkId: string;
    version: number;
    lastOperation: Operation;
    sessionParticipants: ParticipantInfo[];
  }): Promise<void> {
    // This could be used for periodic sync notifications
    // or milestone notifications (e.g., version 100, etc.)

    if (data.version % 100 === 0) {
      const sparkInfo = await this.getSparkInfo(data.sparkId);
      if (!sparkInfo) return;

      for (const participant of data.sessionParticipants) {
        await this.notificationService.createNotification({
          userId: participant.userId,
          type: NotificationType.SYSTEM,
          title: 'Collaboration Milestone',
          message: `"${sparkInfo.title}" has reached ${data.version} collaborative edits!`,
          channels: [NotificationChannel.IN_APP],
          priority: NotificationPriority.LOW,
          data: {
            sparkId: data.sparkId,
            sparkTitle: sparkInfo.title,
            version: data.version
          }
        });
      }
    }
  }

  /**
   * Get operation description for notifications
   */
  private getOperationDescription(operation: Operation): string | null {
    switch (operation.type) {
      case OperationType.INSERT:
        return operation.text && operation.text.length > 20
          ? 'made a significant addition'
          : 'added content';

      case OperationType.DELETE:
        return operation.length && operation.length > 20
          ? 'made a significant deletion'
          : 'deleted content';

      case OperationType.PROPERTY_UPDATE:
        switch (operation.property) {
          case 'title':
            return 'updated the title';
          case 'description':
            return 'updated the description';
          case 'status':
            return 'changed the status';
          default:
            return 'made an update';
        }

      default:
        return null;
    }
  }

  /**
   * Check if an operation is significant enough to warrant notifications
   */
  private isSignificantOperation(operation: Operation): boolean {
    switch (operation.type) {
      case OperationType.INSERT:
        return operation.text ? operation.text.length > 10 : false;

      case OperationType.DELETE:
        return operation.length ? operation.length > 10 : false;

      case OperationType.PROPERTY_UPDATE:
        return ['title', 'description', 'status'].includes(operation.property || '');

      default:
        return false;
    }
  }

  /**
   * Track user activity for analytics and presence
   */
  private async trackUserActivity(
    userId: string,
    sparkId: string,
    activity: string
  ): Promise<void> {
    try {
      // This could be extended to track user activity analytics
      console.log(`User activity: ${userId} ${activity} in spark ${sparkId}`);
    } catch (error) {
      console.error('Failed to track user activity:', error);
    }
  }

  /**
   * Get spark information for notifications
   */
  private async getSparkInfo(sparkId: string): Promise<{ title: string } | null> {
    try {
      // In production, this would fetch from database
      // For now, return mock data
      return { title: `Spark ${sparkId.substring(0, 8)}` };
    } catch (error) {
      console.error('Failed to get spark info:', error);
      return null;
    }
  }

  /**
   * Send notification to offline users about activity they missed
   */
  async sendCatchupNotifications(userId: string, sparkId: string): Promise<void> {
    try {
      const sparkInfo = await this.getSparkInfo(sparkId);
      if (!sparkInfo) return;

      // Get activity since user was last online
      // This would typically query recent operations from the database

      await this.notificationService.createNotification({
        userId,
        type: NotificationType.SPARK_UPDATE,
        title: 'Collaboration Activity',
        message: `You missed some activity in "${sparkInfo.title}" while you were away`,
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        priority: NotificationPriority.MEDIUM,
        data: {
          sparkId,
          sparkTitle: sparkInfo.title,
          type: 'catchup'
        }
      });
    } catch (error) {
      console.error('Failed to send catchup notifications:', error);
    }
  }

  /**
   * Get list of active collaborators for a spark
   */
  getActiveCollaborators(sparkId: string): string[] {
    const activeSparkUsers = this.activeUsers.get(sparkId);
    return activeSparkUsers ? Array.from(activeSparkUsers) : [];
  }

  /**
   * Check if a user is actively collaborating on a spark
   */
  isUserActivelyCollaborating(userId: string, sparkId: string): boolean {
    const activeSparkUsers = this.activeUsers.get(sparkId);
    return activeSparkUsers ? activeSparkUsers.has(userId) : false;
  }

  /**
   * Start cleanup process for inactive sessions
   */
  private startCleanup(): void {
    setInterval(() => {
      // Clean up inactive sessions
      // This would typically check last activity timestamps
      console.log('Cleaning up inactive collaboration sessions...');
    }, 10 * 60 * 1000); // Every 10 minutes
  }

  /**
   * Shutdown integration and cleanup resources
   */
  shutdown(): void {
    this.activeUsers.clear();
    console.log('Collaboration notification integration shut down');
  }
}

export default CollaborationNotificationIntegration;
