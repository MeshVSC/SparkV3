import { emailService } from './EmailService';
import { notificationService } from '../notification/NotificationService';
import { NotificationChannel } from '@/types/notification';

export class EmailServiceIntegration {
  private static instance: EmailServiceIntegration;
  
  private constructor() {
    this.initializeIntegration();
  }

  static getInstance(): EmailServiceIntegration {
    if (!EmailServiceIntegration.instance) {
      EmailServiceIntegration.instance = new EmailServiceIntegration();
    }
    return EmailServiceIntegration.instance;
  }

  private initializeIntegration(): void {
    // Configure email service with environment variables
    this.configureEmailService();
    
    // Listen for notification events that should trigger emails
    this.setupNotificationListeners();
    
    // Listen for email events to update notification delivery status
    this.setupEmailListeners();
  }

  private async configureEmailService(): Promise<void> {
    try {
      // Check for Mailgun configuration first
      if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
        const config = {
          provider: 'mailgun' as const,
          from: process.env.FROM_EMAIL || 'notifications@spark.app',
          apiKey: process.env.MAILGUN_API_KEY,
          domain: process.env.MAILGUN_DOMAIN
        };

        await emailService.configure(config);
        console.log('Email service configured with Mailgun successfully');
        return;
      }
      
      // Fallback to other providers
      const provider = process.env.EMAIL_PROVIDER as 'smtp' | 'sendgrid' | 'ses';
      
      if (!provider) {
        console.warn('No email provider configured. Email notifications will be disabled.');
        return;
      }

      const config = {
        provider,
        from: process.env.EMAIL_FROM || 'notifications@spark.app'
      };

      if (provider === 'smtp') {
        Object.assign(config, {
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
      } else if (provider === 'sendgrid') {
        Object.assign(config, {
          apiKey: process.env.SENDGRID_API_KEY
        });
      }

      await emailService.configure(config);
      console.log('Email service configured successfully');
    } catch (error) {
      console.error('Failed to configure email service:', error);
    }
  }

  private setupNotificationListeners(): void {
    // Listen for notifications that should be sent via email
    notificationService.on('delivery_completed', ({ notification, delivery }) => {
      if (delivery.channel === NotificationChannel.EMAIL) {
        console.log('Email notification delivery completed:', {
          notificationId: notification.id,
          status: delivery.status,
          attempts: delivery.attempts
        });
      }
    });

    // Listen for high-priority notifications to ensure email delivery
    notificationService.on('notification_queued', ({ notification }) => {
      if (
        notification.priority === 'HIGH' && 
        notification.channels.includes(NotificationChannel.EMAIL)
      ) {
        console.log('High-priority email notification queued:', notification.id);
      }
    });
  }

  private setupEmailListeners(): void {
    // Listen for email service events
    emailService.on('email_sent', ({ email, delivery }) => {
      console.log('Email sent successfully:', {
        emailId: email.id,
        to: email.to,
        subject: email.subject
      });
      
      // Update notification service about successful delivery
      notificationService.emit('email_delivery_success', {
        emailId: email.id,
        deliveryId: delivery.id
      });
    });

    emailService.on('email_failed', ({ email, error }) => {
      console.error('Email failed to send:', {
        emailId: email.id,
        to: email.to,
        attempts: email.attempts,
        error: error.message
      });
      
      // Update notification service about failed delivery
      notificationService.emit('email_delivery_failed', {
        emailId: email.id,
        error: error.message,
        attempts: email.attempts
      });
    });

    emailService.on('email_retry_scheduled', ({ email, delay }) => {
      console.log('Email retry scheduled:', {
        emailId: email.id,
        attempt: email.attempts,
        delayMs: delay
      });
    });

    // Listen for webhook events
    emailService.on('webhook_event', (event) => {
      console.log('Email webhook event received:', {
        type: event.type,
        messageId: event.messageId,
        email: event.email
      });
      
      // Forward webhook events to notification service for tracking
      notificationService.emit('email_webhook_event', event);
    });
  }

  // Helper method to trigger specific email types
  async sendSparkUpdateEmail(userId: string, sparkData: any): Promise<string> {
    return emailService.sendEmail(
      [this.getUserEmail(userId)],
      `🔥 ${sparkData.title} has been updated`,
      'spark_updated',
      {
        title: `${sparkData.title} has been updated`,
        message: `Your spark "${sparkData.title}" has been updated with new content.`,
        sparkId: sparkData.id,
        sparkTitle: sparkData.title,
        timestamp: new Date().toISOString()
      }
    );
  }

  async sendCollaborationInviteEmail(
    userId: string, 
    inviterData: any, 
    sparkData: any
  ): Promise<string> {
    return emailService.sendEmail(
      [this.getUserEmail(userId)],
      `🤝 ${inviterData.name} invited you to collaborate`,
      'collaboration_invite',
      {
        title: 'Collaboration Invite',
        message: `${inviterData.name} has invited you to collaborate on "${sparkData.title}".`,
        inviterName: inviterData.name,
        inviterId: inviterData.id,
        sparkId: sparkData.id,
        sparkTitle: sparkData.title,
        timestamp: new Date().toISOString()
      },
      { priority: 'high' }
    );
  }

  async sendMentionEmail(
    userId: string, 
    mentionerData: any, 
    sparkData: any, 
    context?: string
  ): Promise<string> {
    return emailService.sendEmail(
      [this.getUserEmail(userId)],
      `📢 You were mentioned in ${sparkData.title}`,
      'mention',
      {
        title: 'You were mentioned',
        message: `${mentionerData.name} mentioned you in "${sparkData.title}".`,
        mentionerName: mentionerData.name,
        sparkId: sparkData.id,
        sparkTitle: sparkData.title,
        context,
        timestamp: new Date().toISOString()
      }
    );
  }

  private getUserEmail(userId: string): string {
    // In production, this would query the database
    // For now, return a mock email
    return `user-${userId}@example.com`;
  }

  // Health check method
  async getHealthStatus(): Promise<any> {
    const emailHealth = await emailService.healthCheck();
    const stats = emailService.getStats();
    
    return {
      emailService: emailHealth,
      stats,
      integration: {
        configured: true,
        listenersActive: true
      }
    };
  }

  // Method to test email functionality
  async sendTestEmail(to: string): Promise<string> {
    return emailService.sendEmail(
      [to],
      '🧪 Spark Email Service Test',
      'spark_updated',
      {
        title: 'Email Service Test',
        message: 'This is a test email to verify the email service is working correctly.',
        sparkId: 'test-spark-123',
        sparkTitle: 'Test Spark',
        timestamp: new Date().toISOString()
      }
    );
  }
}

// Export singleton instance
export const emailServiceIntegration = EmailServiceIntegration.getInstance();