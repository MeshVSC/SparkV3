import { NextRequest, NextResponse } from 'next/server';
import { notificationService } from '@/lib/notification/NotificationService';
import { emailServiceIntegration } from '@/lib/email/EmailServiceIntegration';
import { z } from 'zod';

const testNotificationSchema = z.object({
  type: z.enum(['spark_updated', 'collaboration_invite', 'mention', 'achievement_unlocked']).optional().default('spark_updated'),
  userId: z.string().optional().default('test-user-123'),
  includeEmail: z.boolean().optional().default(true)
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, userId, includeEmail } = testNotificationSchema.parse(body);

    let eventData: Record<string, any>;
    let notificationId: string;

    switch (type) {
      case 'spark_updated':
        eventData = {
          sparkId: 'test-spark-456',
          sparkTitle: 'My Test Spark',
          timestamp: new Date().toISOString()
        };
        notificationId = await notificationService.createNotification({
          userId,
          type: 'spark_updated',
          title: 'Spark Updated',
          message: `Your spark "${eventData.sparkTitle}" has been updated`,
          channels: includeEmail ? ['in_app', 'email'] as any : ['in_app'] as any,
          priority: 'MEDIUM' as any,
          data: eventData
        });
        break;
        
      case 'collaboration_invite':
        eventData = {
          inviterId: 'test-inviter-789',
          inviterName: 'John Doe',
          sparkId: 'test-spark-456',
          sparkTitle: 'Collaboration Test Spark',
          timestamp: new Date().toISOString()
        };
        notificationId = await notificationService.createNotification({
          userId,
          type: 'collaboration_invite',
          title: 'Collaboration Invite',
          message: `${eventData.inviterName} invited you to collaborate on "${eventData.sparkTitle}"`,
          channels: includeEmail ? ['in_app', 'email'] as any : ['in_app'] as any,
          priority: 'HIGH' as any,
          data: eventData
        });
        break;
        
      case 'mention':
        eventData = {
          mentionerId: 'test-mentioner-101',
          mentionerName: 'Jane Smith',
          sparkId: 'test-spark-456',
          sparkTitle: 'Mention Test Spark',
          context: 'Hey @user, what do you think about this idea?',
          timestamp: new Date().toISOString()
        };
        notificationId = await notificationService.createNotification({
          userId,
          type: 'mention',
          title: 'You were mentioned',
          message: `${eventData.mentionerName} mentioned you in "${eventData.sparkTitle}"`,
          channels: includeEmail ? ['in_app', 'email'] as any : ['in_app'] as any,
          priority: 'HIGH' as any,
          data: eventData
        });
        break;
        
      case 'achievement_unlocked':
        eventData = {
          achievementId: 'test-achievement-202',
          achievementName: 'Spark Master',
          timestamp: new Date().toISOString()
        };
        notificationId = await notificationService.createNotification({
          userId,
          type: 'achievement_unlocked',
          title: 'Achievement Unlocked!',
          message: `Congratulations! You've unlocked "${eventData.achievementName}"`,
          channels: includeEmail ? ['in_app', 'push'] as any : ['in_app'] as any,
          priority: 'HIGH' as any,
          data: eventData
        });
        break;
        
      default:
        throw new Error(`Unknown notification type: ${type}`);
    }

    return NextResponse.json({
      success: true,
      notificationId,
      message: `Test notification (${type}) created successfully`,
      data: {
        type,
        userId,
        includeEmail,
        eventData
      }
    });
  } catch (error) {
    console.error('Test notification API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation error',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to create test notification',
      message: (error as Error).message
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const stats = notificationService.getDeliveryStats();
    const emailHealth = await emailServiceIntegration.getHealthStatus();
    
    return NextResponse.json({
      success: true,
      notificationService: {
        stats,
        availableChannels: ['in_app', 'email', 'push']
      },
      emailService: emailHealth,
      availableTestTypes: [
        'spark_updated',
        'collaboration_invite',
        'mention',
        'achievement_unlocked'
      ]
    });
  } catch (error) {
    console.error('Notification service health check error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get notification service health'
    }, { status: 500 });
  }
}