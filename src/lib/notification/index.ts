// Main exports for the notification system
export { NotificationService, notificationService } from './NotificationService';
export { SocketNotificationIntegration, socketNotificationIntegration } from './SocketNotificationIntegration';

// Channel handlers
export { InAppChannelHandler } from './channels/InAppChannelHandler';
export { EmailChannelHandler } from './channels/EmailChannelHandler';
export { PushChannelHandler } from './channels/PushChannelHandler';

// Types
export * from '@/types/notification';

// Hooks and components
export { useNotifications, useNotificationPermission } from '@/hooks/useNotifications';
export { NotificationCenter } from '@/components/notifications/NotificationCenter';

// Utility functions
export const createNotification = (
  userId: string,
  type: string,
  title: string,
  message: string,
  data?: Record<string, any>
) => {
  return notificationService.emitEvent(type, userId, {
    title,
    message,
    ...data
  });
};

export const createImmediateNotification = (
  userId: string,
  type: any,
  title: string,
  message: string,
  channels: any[] = [],
  priority: any = 2,
  data?: Record<string, any>
) => {
  return notificationService.createNotification({
    userId,
    type,
    title,
    message,
    channels,
    priority,
    data
  });
};

// Event helpers for common notification patterns
export const notifySparkUpdate = (userId: string, sparkId: string, sparkTitle: string, changeType: string) => {
  return notificationService.emitEvent('spark_updated', userId, {
    sparkId,
    sparkTitle,
    changeType
  });
};

export const notifyAchievementUnlocked = (userId: string, achievementId: string, achievementName: string) => {
  return notificationService.emitEvent('achievement_unlocked', userId, {
    achievementId,
    achievementName
  });
};

export const notifyCollaborationInvite = (
  invitedUserId: string, 
  sparkId: string, 
  sparkTitle: string, 
  inviterId: string, 
  inviterName: string
) => {
  return notificationService.emitEvent('collaboration_invite', invitedUserId, {
    sparkId,
    sparkTitle,
    inviterId,
    inviterName
  });
};

export const notifyCollaborationAction = (
  userId: string, 
  sparkId: string, 
  sparkTitle: string, 
  userName: string, 
  action: string
) => {
  return notificationService.emitEvent('collaboration_action', userId, {
    sparkId,
    sparkTitle,
    userId,
    userName,
    action
  });
};