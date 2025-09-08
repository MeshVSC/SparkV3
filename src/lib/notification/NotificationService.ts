import { EventEmitter } from 'events';
import { 
  NotificationData, 
  NotificationDelivery, 
  NotificationQueue, 
  NotificationEvent, 
  NotificationRule,
  NotificationTemplate,
  NotificationType,
  NotificationChannel,
  NotificationPriority,
  DeliveryStatus,
  NotificationDeliveryStats,
  NotificationChannelHandler,
  ChannelConfig
} from '@/types/notification';
import { v4 as uuidv4 } from 'uuid';
import { InAppChannelHandler } from './channels/InAppChannelHandler';
import { EmailChannelHandler } from './channels/EmailChannelHandler';
import { PushChannelHandler } from './channels/PushChannelHandler';

export class NotificationService extends EventEmitter {
  private static instance: NotificationService;
  private queue: NotificationQueue[] = [];
  private deliveries: Map<string, NotificationDelivery[]> = new Map();
  private rules: Map<string, NotificationRule> = new Map();
  private channelHandlers: Map<NotificationChannel, NotificationChannelHandler> = new Map();
  private channelConfigs: Map<NotificationChannel, ChannelConfig> = new Map();
  private isProcessing: boolean = false;
  private processingIntervalId?: NodeJS.Timeout;
  private batchSize: number = 10;
  private maxRetries: number = 3;
  private retryDelays: number[] = [1000, 5000, 15000]; // 1s, 5s, 15s
  private stats: NotificationDeliveryStats = {
    total: 0,
    delivered: 0,
    failed: 0,
    pending: 0,
    processing: 0,
    retrying: 0,
    deliveryRate: 0,
    averageDeliveryTime: 0
  };

  private constructor() {
    super();
    this.initializeChannelHandlers();
    this.initializeDefaultRules();
    this.startQueueProcessor();
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Event handling methods
  async emitEvent(type: string, userId: string, data: Record<string, any>): Promise<void> {
    const event: NotificationEvent = {
      type,
      userId,
      data,
      timestamp: new Date()
    };

    this.emit('notification_event', event);
    await this.processEvent(event);
  }

  // Rule management
  addRule(rule: NotificationRule): void {
    this.rules.set(rule.id, rule);
    this.emit('rule_added', rule);
  }

  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      this.emit('rule_removed', ruleId);
    }
    return removed;
  }

  getRule(ruleId: string): NotificationRule | undefined {
    return this.rules.get(ruleId);
  }

  getAllRules(): NotificationRule[] {
    return Array.from(this.rules.values());
  }

  updateRule(ruleId: string, updates: Partial<NotificationRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;
    
    const updatedRule = { ...rule, ...updates };
    this.rules.set(ruleId, updatedRule);
    this.emit('rule_updated', updatedRule);
    return true;
  }

  // Direct notification creation
  async createNotification(notification: Omit<NotificationData, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const notificationData: NotificationData = {
      ...notification,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return this.queueNotification(notificationData);
  }

  // Queue management
  private async queueNotification(notification: NotificationData): Promise<string> {
    const queueItem: NotificationQueue = {
      id: uuidv4(),
      notificationId: notification.id,
      priority: notification.priority,
      scheduledAt: notification.scheduledAt || new Date(),
      attempts: 0,
      createdAt: new Date()
    };

    // Insert in priority order
    const insertIndex = this.queue.findIndex(item => item.priority < notification.priority);
    if (insertIndex === -1) {
      this.queue.push(queueItem);
    } else {
      this.queue.splice(insertIndex, 0, queueItem);
    }

    this.emit('notification_queued', { notification, queueItem });
    await this.persistNotification(notification);
    
    return notification.id;
  }

  private async processEvent(event: NotificationEvent): Promise<void> {
    const applicableRules = Array.from(this.rules.values())
      .filter(rule => 
        rule.enabled && 
        rule.eventType === event.type &&
        (!rule.condition || rule.condition(event.data))
      );

    for (const rule of applicableRules) {
      const notification = await this.createNotificationFromRule(rule, event);
      if (notification) {
        await this.queueNotification(notification);
      }
    }
  }

  private async createNotificationFromRule(rule: NotificationRule, event: NotificationEvent): Promise<NotificationData | null> {
    try {
      const template = rule.template;
      
      const title = typeof template.title === 'function' 
        ? template.title(event.data)
        : template.title;
      
      const message = typeof template.message === 'function'
        ? template.message(event.data)
        : template.message;
      
      const data = template.data
        ? typeof template.data === 'function'
          ? template.data(event.data)
          : template.data
        : event.data;

      return {
        id: uuidv4(),
        userId: event.userId,
        type: event.type as NotificationType,
        title,
        message,
        channels: rule.channels,
        priority: rule.priority,
        data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      console.error('Error creating notification from rule:', error);
      this.emit('notification_error', { error, rule, event });
      return null;
    }
  }

  // Queue processing
  private startQueueProcessor(): void {
    this.processingIntervalId = setInterval(() => {
      if (!this.isProcessing && this.queue.length > 0) {
        this.processQueue();
      }
    }, 1000);
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    this.emit('queue_processing_started');

    try {
      const batch = this.getBatchToProcess();
      await this.processBatch(batch);
    } catch (error) {
      console.error('Queue processing error:', error);
      this.emit('queue_processing_error', error);
    } finally {
      this.isProcessing = false;
      this.emit('queue_processing_completed');
    }
  }

  private getBatchToProcess(): NotificationQueue[] {
    const now = new Date();
    return this.queue
      .filter(item => item.scheduledAt <= now)
      .slice(0, this.batchSize);
  }

  private async processBatch(batch: NotificationQueue[]): Promise<void> {
    const notifications = await Promise.all(
      batch.map(item => this.getNotificationById(item.notificationId))
    );

    for (let i = 0; i < batch.length; i++) {
      const queueItem = batch[i];
      const notification = notifications[i];
      
      if (!notification) {
        this.removeFromQueue(queueItem.id);
        continue;
      }

      try {
        await this.deliverNotification(notification);
        this.removeFromQueue(queueItem.id);
      } catch (error) {
        await this.handleDeliveryFailure(queueItem, error as Error);
      }
    }
  }

  private async deliverNotification(notification: NotificationData): Promise<void> {
    this.stats.processing++;
    
    const deliveryPromises = notification.channels.map(channel => 
      this.deliverToChannel(notification, channel)
    );

    await Promise.allSettled(deliveryPromises);
    this.stats.processing--;
    this.stats.total++;
  }

  private async deliverToChannel(notification: NotificationData, channel: NotificationChannel): Promise<void> {
    const handler = this.channelHandlers.get(channel);
    if (!handler) {
      throw new Error(`No handler found for channel: ${channel}`);
    }

    const config = this.channelConfigs.get(channel);
    if (!config?.enabled) {
      console.warn(`Channel ${channel} is disabled, skipping delivery`);
      return;
    }

    // Check rate limits
    if (config.rateLimits && !await this.checkRateLimit(notification.userId, channel, config)) {
      throw new Error(`Rate limit exceeded for channel: ${channel}`);
    }

    const delivery: NotificationDelivery = {
      id: uuidv4(),
      notificationId: notification.id,
      channel,
      status: DeliveryStatus.PROCESSING,
      attempts: 1,
      lastAttemptAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      await this.persistDelivery(delivery);
      
      const success = await handler.send(notification, delivery);
      
      if (success) {
        delivery.status = DeliveryStatus.DELIVERED;
        delivery.deliveredAt = new Date();
        this.stats.delivered++;
      } else {
        delivery.status = DeliveryStatus.FAILED;
        delivery.errorMessage = 'Handler returned false';
        this.stats.failed++;
      }
    } catch (error) {
      delivery.status = DeliveryStatus.FAILED;
      delivery.errorMessage = (error as Error).message;
      this.stats.failed++;
    }

    delivery.updatedAt = new Date();
    await this.updateDelivery(delivery);
    this.emit('delivery_completed', { notification, delivery });
  }

  private async handleDeliveryFailure(queueItem: NotificationQueue, error: Error): Promise<void> {
    queueItem.attempts++;
    
    if (queueItem.attempts > this.maxRetries) {
      console.error(`Max retries exceeded for notification ${queueItem.notificationId}:`, error);
      this.removeFromQueue(queueItem.id);
      this.emit('notification_failed', { queueItem, error });
      return;
    }

    // Schedule retry with exponential backoff
    const delay = this.retryDelays[Math.min(queueItem.attempts - 1, this.retryDelays.length - 1)];
    queueItem.scheduledAt = new Date(Date.now() + delay);
    this.stats.retrying++;
    
    this.emit('notification_retry_scheduled', { queueItem, delay, error });
  }

  // Channel management
  private initializeChannelHandlers(): void {
    this.channelHandlers.set(NotificationChannel.IN_APP, new InAppChannelHandler());
    this.channelHandlers.set(NotificationChannel.EMAIL, new EmailChannelHandler());
    this.channelHandlers.set(NotificationChannel.PUSH, new PushChannelHandler());

    // Initialize default channel configs
    this.channelConfigs.set(NotificationChannel.IN_APP, {
      enabled: true,
      rateLimits: { maxPerHour: 100, maxPerDay: 500 }
    });
    
    this.channelConfigs.set(NotificationChannel.EMAIL, {
      enabled: true,
      rateLimits: { maxPerHour: 10, maxPerDay: 50 }
    });
    
    this.channelConfigs.set(NotificationChannel.PUSH, {
      enabled: true,
      rateLimits: { maxPerHour: 20, maxPerDay: 100 }
    });
  }

  setChannelConfig(channel: NotificationChannel, config: ChannelConfig): void {
    this.channelConfigs.set(channel, config);
    this.emit('channel_config_updated', { channel, config });
  }

  getChannelConfig(channel: NotificationChannel): ChannelConfig | undefined {
    return this.channelConfigs.get(channel);
  }

  // Default notification rules
  private initializeDefaultRules(): void {
    // Spark update notifications
    this.addRule({
      id: 'spark_update',
      eventType: 'spark_updated',
      template: {
        title: 'Spark Updated',
        message: (data) => `Your spark "${data.sparkTitle}" has been updated`,
        data: (data) => ({ sparkId: data.sparkId, sparkTitle: data.sparkTitle })
      },
      channels: [NotificationChannel.IN_APP],
      priority: NotificationPriority.MEDIUM,
      enabled: true
    });

    // Achievement notifications
    this.addRule({
      id: 'achievement_unlocked',
      eventType: 'achievement_unlocked',
      template: {
        title: 'Achievement Unlocked!',
        message: (data) => `Congratulations! You've unlocked "${data.achievementName}"`,
        data: (data) => ({ achievementId: data.achievementId, achievementName: data.achievementName })
      },
      channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      priority: NotificationPriority.HIGH,
      enabled: true
    });

    // Collaboration notifications
    this.addRule({
      id: 'collaboration_invite',
      eventType: 'collaboration_invite',
      template: {
        title: 'Collaboration Invite',
        message: (data) => `${data.inviterName} invited you to collaborate on "${data.sparkTitle}"`,
        data: (data) => ({ 
          sparkId: data.sparkId, 
          sparkTitle: data.sparkTitle,
          inviterId: data.inviterId,
          inviterName: data.inviterName
        })
      },
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      priority: NotificationPriority.HIGH,
      enabled: true
    });

    this.addRule({
      id: 'collaboration_action',
      eventType: 'collaboration_action',
      template: {
        title: 'Collaboration Update',
        message: (data) => `${data.userName} ${data.action} in "${data.sparkTitle}"`,
        data: (data) => ({
          sparkId: data.sparkId,
          sparkTitle: data.sparkTitle,
          userId: data.userId,
          userName: data.userName,
          action: data.action
        })
      },
      channels: [NotificationChannel.IN_APP],
      priority: NotificationPriority.MEDIUM,
      enabled: true
    });
  }

  // Utility methods
  private removeFromQueue(queueId: string): void {
    const index = this.queue.findIndex(item => item.id === queueId);
    if (index !== -1) {
      this.queue.splice(index, 1);
    }
  }

  private async checkRateLimit(userId: string, channel: NotificationChannel, config: ChannelConfig): Promise<boolean> {
    if (!config.rateLimits) return true;
    
    // This is a simplified rate limiting implementation
    // In production, you'd want to use Redis or a proper rate limiting service
    const now = Date.now();
    const hourAgo = now - (60 * 60 * 1000);
    const dayAgo = now - (24 * 60 * 60 * 1000);
    
    // Get user's deliveries for this channel
    const deliveries = this.deliveries.get(userId) || [];
    const channelDeliveries = deliveries.filter(d => d.channel === channel);
    
    const hourlyCount = channelDeliveries.filter(d => 
      d.createdAt.getTime() > hourAgo && d.status === DeliveryStatus.DELIVERED
    ).length;
    
    const dailyCount = channelDeliveries.filter(d => 
      d.createdAt.getTime() > dayAgo && d.status === DeliveryStatus.DELIVERED
    ).length;
    
    return hourlyCount < config.rateLimits.maxPerHour && dailyCount < config.rateLimits.maxPerDay;
  }

  // Statistics
  getDeliveryStats(): NotificationDeliveryStats {
    const total = this.stats.total || 1; // Avoid division by zero
    return {
      ...this.stats,
      deliveryRate: (this.stats.delivered / total) * 100,
      averageDeliveryTime: 0 // Would be calculated from delivery timestamps in production
    };
  }

  // Persistence methods (placeholder implementations)
  private async persistNotification(notification: NotificationData): Promise<void> {
    // In production, persist to database
    console.debug('Persisting notification:', notification.id);
  }

  private async getNotificationById(id: string): Promise<NotificationData | null> {
    // In production, fetch from database
    // For now, return a mock notification
    return {
      id,
      userId: 'mock-user',
      type: NotificationType.SYSTEM,
      title: 'Mock notification',
      message: 'This is a mock notification',
      channels: [NotificationChannel.IN_APP],
      priority: NotificationPriority.MEDIUM,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private async persistDelivery(delivery: NotificationDelivery): Promise<void> {
    // In production, persist to database
    const userDeliveries = this.deliveries.get(delivery.id.split('-')[0]) || [];
    userDeliveries.push(delivery);
    this.deliveries.set(delivery.id.split('-')[0], userDeliveries);
  }

  private async updateDelivery(delivery: NotificationDelivery): Promise<void> {
    // In production, update database
    console.debug('Updating delivery:', delivery.id, delivery.status);
  }

  // Cleanup
  shutdown(): void {
    if (this.processingIntervalId) {
      clearInterval(this.processingIntervalId);
    }
    this.queue = [];
    this.deliveries.clear();
    this.rules.clear();
    this.removeAllListeners();
  }
}

export const notificationService = NotificationService.getInstance();