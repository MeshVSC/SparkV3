import { NotificationData, NotificationDelivery, NotificationChannel, NotificationChannelHandler } from '@/types/notification';
import { emailService } from '@/lib/email/EmailService';

export class EmailChannelHandler implements NotificationChannelHandler {
  channel = NotificationChannel.EMAIL;

  async send(notification: NotificationData, delivery: NotificationDelivery): Promise<boolean> {
    try {
      // Use the new EmailService for sending notifications
      const emailId = await emailService.sendNotificationEmail(notification);
      
      console.log(`Email notification queued successfully for user ${notification.userId}, emailId: ${emailId}`);
      return true;
    } catch (error) {
      console.error('Email notification delivery failed:', error);
      return false;
    }
  }

  private getUserEmail(userId: string): string {
    // In production, this would query the database to get the user's email
    // For now, return a mock email
    return `user-${userId}@example.com`;
  }

  validateConfig(config: EmailConfig): boolean {
    // Validate email configuration
    if (!config.fromEmail || !config.fromEmail.includes('@')) {
      return false;
    }
    
    if (config.provider === 'sendgrid' && !config.apiKey) {
      return false;
    }
    
    if (config.provider === 'mailgun' && (!config.apiKey || !config.domain)) {
      return false;
    }
    
    if (config.provider === 'smtp' && (!config.host || !config.port)) {
      return false;
    }
    
    return true;
  }
}

interface EmailConfig {
  provider: 'sendgrid' | 'smtp' | 'ses' | 'mailgun';
  fromEmail: string;
  apiKey?: string;
  domain?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
}