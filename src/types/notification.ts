export enum NotificationType {
  SPARK_UPDATE = 'spark_update',
  ACHIEVEMENT_UNLOCKED = 'achievement_unlocked',
  COLLABORATION_INVITE = 'collaboration_invite',
  COLLABORATION_ACTION = 'collaboration_action',
  SYSTEM = 'system',
  REMINDER = 'reminder'
}

export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  PUSH = 'push'
}

export enum NotificationPriority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  URGENT = 4
}

export enum DeliveryStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RETRYING = 'retrying'
}

export interface NotificationData {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  data?: Record<string, any>;
  scheduledAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationDelivery {
  id: string;
  notificationId: string;
  channel: NotificationChannel;
  status: DeliveryStatus;
  attempts: number;
  lastAttemptAt?: Date;
  deliveredAt?: Date;
  errorMessage?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationDeliveryStats {
  total: number;
  delivered: number;
  failed: number;
  pending: number;
  processing: number;
  retrying: number;
  deliveryRate: number;
  averageDeliveryTime: number;
}

export interface NotificationQueue {
  id: string;
  notificationId: string;
  priority: NotificationPriority;
  scheduledAt: Date;
  attempts: number;
  createdAt: Date;
}

export interface NotificationEvent {
  type: string;
  userId: string;
  data: Record<string, any>;
  timestamp: Date;
}

export interface NotificationRule {
  id: string;
  eventType: string;
  condition?: (data: any) => boolean;
  template: NotificationTemplate;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  enabled: boolean;
}

export interface NotificationTemplate {
  title: string | ((data: any) => string);
  message: string | ((data: any) => string);
  data?: Record<string, any> | ((data: any) => Record<string, any>);
}

export interface ChannelConfig {
  enabled: boolean;
  rateLimits?: {
    maxPerHour: number;
    maxPerDay: number;
  };
  retryConfig?: {
    maxRetries: number;
    retryDelays: number[];
  };
}

export interface NotificationChannelHandler {
  channel: NotificationChannel;
  send(notification: NotificationData, delivery: NotificationDelivery): Promise<boolean>;
  validateConfig?(config: any): boolean;
}