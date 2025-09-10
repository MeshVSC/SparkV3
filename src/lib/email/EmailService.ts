import { EventEmitter } from 'events';
import nodemailer, { Transporter, SendMailOptions } from 'nodemailer';
import { NotificationData, NotificationDelivery, NotificationChannel, DeliveryStatus } from '@/types/notification';
import { EmailTemplate, EmailConfig, EmailQueue } from '@/types/email';
import { v4 as uuidv4 } from 'uuid';

export class EmailService extends EventEmitter {
  private static instance: EmailService;
  private transporter: Transporter | null = null;
  private config: EmailConfig | null = null;
  private queue: EmailQueue[] = [];
  private deliveries: Map<string, any> = new Map();
  private templates: Map<string, EmailTemplate> = new Map();
  private isProcessingQueue = false;
  private maxRetries = 3;
  private retryDelays = [1000, 5000, 15000]; // 1s, 5s, 15s
  private stats = {
    sent: 0,
    failed: 0,
    pending: 0,
    processing: 0
  };

  private constructor() {
    super();
    this.initializeDefaultTemplates();
    this.startQueueProcessor();
  }

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  // Configuration
  async configure(config: EmailConfig): Promise<void> {
    this.config = config;

    if (config.provider === 'smtp') {
      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure || false,
        auth: config.auth ? {
          user: config.auth.user,
          pass: config.auth.pass
        } : undefined
      });
    } else if (config.provider === 'sendgrid') {
      this.transporter = nodemailer.createTransport({
        service: 'SendGrid',
        auth: {
          user: 'apikey',
          pass: config.apiKey
        }
      });
    } else if (config.provider === 'mailgun') {
      this.transporter = nodemailer.createTransport({
        host: 'smtp.mailgun.org',
        port: 587,
        secure: false,
        auth: {
          user: `postmaster@${(config as any).domain}`,
          pass: config.apiKey
        }
      });
    }

    // Verify connection
    if (this.transporter) {
      try {
        await this.transporter.verify();
        console.log('Email service configured successfully');
        this.emit('configured');
      } catch (error) {
        console.error('Email service configuration failed:', error);
        this.emit('configuration_failed', error);
        throw error;
      }
    }
  }

  // Template management
  registerTemplate(type: string, template: EmailTemplate): void {
    this.templates.set(type, template);
    this.emit('template_registered', { type, template });
  }

  getTemplate(type: string): EmailTemplate | undefined {
    return this.templates.get(type);
  }

  // Email sending methods
  async sendNotificationEmail(notification: NotificationData): Promise<string> {
    const template = this.getTemplate(notification.type);
    if (!template) {
      throw new Error(`No email template found for notification type: ${notification.type}`);
    }

    const email = this.buildEmailFromNotification(notification, template);
    return this.queueEmail(email);
  }

  async sendEmail(
    to: string | string[],
    subject: string,
    template: string,
    data: Record<string, any> = {},
    options: Partial<SendMailOptions> = {}
  ): Promise<string> {
    const emailTemplate = this.getTemplate(template);
    if (!emailTemplate) {
      throw new Error(`Email template '${template}' not found`);
    }

    const email: EmailQueue = {
      id: uuidv4(),
      to: Array.isArray(to) ? to : [to],
      subject,
      templateType: template,
      templateData: data,
      options,
      priority: options.priority as any || 'medium',
      attempts: 0,
      createdAt: new Date(),
      scheduledAt: new Date()
    };

    return this.queueEmail(email);
  }

  // Queue management
  private queueEmail(email: EmailQueue): string {
    // Insert based on priority
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const insertIndex = this.queue.findIndex(
      item => priorityOrder[item.priority] < priorityOrder[email.priority]
    );

    if (insertIndex === -1) {
      this.queue.push(email);
    } else {
      this.queue.splice(insertIndex, 0, email);
    }

    this.stats.pending++;
    this.emit('email_queued', email);
    return email.id;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.queue.length === 0 || !this.transporter) {
      return;
    }

    this.isProcessingQueue = true;
    this.emit('queue_processing_started');

    try {
      const now = new Date();
      const batch = this.queue
        .filter(email => email.scheduledAt <= now)
        .slice(0, 5); // Process 5 emails at a time

      for (const email of batch) {
        try {
          await this.processEmail(email);
          this.removeFromQueue(email.id);
        } catch (error) {
          await this.handleEmailFailure(email, error as Error);
        }
      }
    } catch (error) {
      console.error('Queue processing error:', error);
      this.emit('queue_processing_error', error);
    } finally {
      this.isProcessingQueue = false;
      this.emit('queue_processing_completed');
    }
  }

  private async processEmail(email: EmailQueue): Promise<void> {
    this.stats.processing++;
    this.stats.pending--;

    const template = this.getTemplate(email.templateType);
    if (!template) {
      throw new Error(`Template not found: ${email.templateType}`);
    }

    const htmlContent = this.renderTemplate(template.html, email.templateData);
    const textContent = this.renderTemplate(template.text || '', email.templateData);

    const mailOptions: SendMailOptions = {
      from: this.config?.from || 'notifications@spark.app',
      to: email.to,
      subject: this.renderTemplate(email.subject, email.templateData),
      html: htmlContent,
      text: textContent,
      ...email.options
    };

    const delivery: NotificationDelivery = {
      id: uuidv4(),
      notificationId: email.id,
      channel: NotificationChannel.EMAIL,
      status: DeliveryStatus.PROCESSING,
      attempts: email.attempts + 1,
      lastAttemptAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      if (!this.transporter) {
        throw new Error('Email transporter not configured');
      }

      const result = await this.transporter.sendMail(mailOptions);

      delivery.status = DeliveryStatus.DELIVERED;
      delivery.deliveredAt = new Date();
      (delivery as any).providerMessageId = result.messageId;

      this.stats.sent++;
      this.stats.processing--;

      this.emit('email_sent', { email, delivery, result });
    } catch (error) {
      delivery.status = DeliveryStatus.FAILED;
      delivery.errorMessage = (error as Error).message;

      this.stats.failed++;
      this.stats.processing--;

      throw error;
    } finally {
      delivery.updatedAt = new Date();
      this.deliveries.set(delivery.id, delivery);
    }
  }

  private async handleEmailFailure(email: EmailQueue, error: Error): Promise<void> {
    email.attempts++;

    if (email.attempts >= this.maxRetries) {
      console.error(`Max retries exceeded for email ${email.id}:`, error);
      this.removeFromQueue(email.id);
      this.emit('email_failed', { email, error });
      return;
    }

    // Schedule retry with exponential backoff
    const delay = this.retryDelays[Math.min(email.attempts - 1, this.retryDelays.length - 1)];
    email.scheduledAt = new Date(Date.now() + delay);

    this.emit('email_retry_scheduled', { email, delay, error });
  }

  private removeFromQueue(emailId: string): void {
    const index = this.queue.findIndex(email => email.id === emailId);
    if (index !== -1) {
      this.queue.splice(index, 1);
    }
  }

  // Template rendering
  private renderTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key]?.toString() || '';
    });
  }

  private buildEmailFromNotification(notification: NotificationData, template: EmailTemplate): EmailQueue {
    const templateData = {
      title: notification.title,
      message: notification.message,
      userId: notification.userId,
      notificationId: notification.id,
      appUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000',
      ...notification.data
    };

    return {
      id: uuidv4(),
      to: [this.getUserEmail(notification.userId)],
      subject: template.subject || notification.title,
      templateType: notification.type,
      templateData,
      priority: this.mapPriorityToEmailPriority(notification.priority),
      attempts: 0,
      createdAt: new Date(),
      scheduledAt: new Date()
    };
  }

  private getUserEmail(userId: string): string {
    // In production, query the database for user's email
    // For now, return a mock email
    return `user-${userId}@example.com`;
  }

  private mapPriorityToEmailPriority(priority: any): 'high' | 'medium' | 'low' {
    const priorityMap: Record<string, 'high' | 'medium' | 'low'> = {
      'HIGH': 'high',
      'MEDIUM': 'medium',
      'LOW': 'low'
    };
    return priorityMap[priority] || 'medium';
  }

  // Default email templates
  private initializeDefaultTemplates(): void {
    // Spark update notification template
    this.registerTemplate('spark_updated', {
      subject: '🔥 {{title}}',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>{{title}}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #1f2937;
              margin: 0;
              padding: 0;
              background-color: #f9fafb;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: white;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white;
              padding: 32px 24px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 600;
            }
            .content {
              padding: 32px 24px;
            }
            .message {
              font-size: 16px;
              margin-bottom: 24px;
              line-height: 1.5;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background-color: #10b981;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 500;
              transition: background-color 0.2s;
            }
            .button:hover {
              background-color: #059669;
            }
            .footer {
              padding: 24px;
              text-align: center;
              font-size: 14px;
              color: #6b7280;
              border-top: 1px solid #e5e7eb;
            }
            .spark-info {
              background-color: #f3f4f6;
              padding: 16px;
              border-radius: 6px;
              margin: 16px 0;
              border-left: 4px solid #10b981;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✨ Spark Updated</h1>
            </div>
            <div class="content">
              <div class="message">{{message}}</div>
              {{#sparkId}}
              <div class="spark-info">
                <strong>Spark:</strong> {{sparkTitle}}<br>
                <strong>Updated:</strong> {{timestamp}}
              </div>
              {{/sparkId}}
              <a href="{{appUrl}}/sparks/{{sparkId}}" class="button">View Spark</a>
            </div>
            <div class="footer">
              <p>You're receiving this because you have notifications enabled.</p>
              <p><a href="{{appUrl}}/settings/notifications" style="color: #10b981;">Manage notification preferences</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        {{title}}

        {{message}}

        {{#sparkId}}
        Spark: {{sparkTitle}}
        Updated: {{timestamp}}
        {{/sparkId}}

        View Spark: {{appUrl}}/sparks/{{sparkId}}

        ---
        You're receiving this because you have notifications enabled.
        Manage preferences: {{appUrl}}/settings/notifications
      `
    });

    // Collaboration invite template
    this.registerTemplate('collaboration_invite', {
      subject: '🤝 {{inviterName}} invited you to collaborate',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Collaboration Invite</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #1f2937;
              margin: 0;
              padding: 0;
              background-color: #f9fafb;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: white;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
              color: white;
              padding: 32px 24px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 600;
            }
            .content {
              padding: 32px 24px;
            }
            .message {
              font-size: 16px;
              margin-bottom: 24px;
              line-height: 1.5;
            }
            .invite-info {
              background-color: #f0f9ff;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
              border-left: 4px solid #3b82f6;
            }
            .button-group {
              text-align: center;
              margin: 24px 0;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              margin: 0 8px;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 500;
              transition: all 0.2s;
            }
            .button-accept {
              background-color: #10b981;
            }
            .button-accept:hover {
              background-color: #059669;
            }
            .button-decline {
              background-color: #6b7280;
            }
            .button-decline:hover {
              background-color: #4b5563;
            }
            .footer {
              padding: 24px;
              text-align: center;
              font-size: 14px;
              color: #6b7280;
              border-top: 1px solid #e5e7eb;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🤝 Collaboration Invite</h1>
            </div>
            <div class="content">
              <div class="message">{{message}}</div>
              <div class="invite-info">
                <strong>Inviter:</strong> {{inviterName}}<br>
                <strong>Spark:</strong> {{sparkTitle}}<br>
                <strong>Invited:</strong> {{timestamp}}
              </div>
              <div class="button-group">
                <a href="{{appUrl}}/collaborate/{{sparkId}}/accept" class="button button-accept">Accept Invite</a>
                <a href="{{appUrl}}/collaborate/{{sparkId}}/decline" class="button button-decline">Decline</a>
              </div>
            </div>
            <div class="footer">
              <p>You're receiving this because someone invited you to collaborate.</p>
              <p><a href="{{appUrl}}/settings/notifications" style="color: #3b82f6;">Manage notification preferences</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Collaboration Invite

        {{message}}

        Inviter: {{inviterName}}
        Spark: {{sparkTitle}}
        Invited: {{timestamp}}

        Accept: {{appUrl}}/collaborate/{{sparkId}}/accept
        Decline: {{appUrl}}/collaborate/{{sparkId}}/decline

        ---
        Manage preferences: {{appUrl}}/settings/notifications
      `
    });

    // Mention notification template
    this.registerTemplate('mention', {
      subject: '📢 You were mentioned in {{sparkTitle}}',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>You were mentioned</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #1f2937;
              margin: 0;
              padding: 0;
              background-color: #f9fafb;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: white;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
              color: white;
              padding: 32px 24px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 600;
            }
            .content {
              padding: 32px 24px;
            }
            .message {
              font-size: 16px;
              margin-bottom: 24px;
              line-height: 1.5;
            }
            .mention-context {
              background-color: #fffbeb;
              padding: 16px;
              border-radius: 6px;
              margin: 16px 0;
              border-left: 4px solid #f59e0b;
              font-style: italic;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background-color: #f59e0b;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 500;
              transition: background-color 0.2s;
            }
            .button:hover {
              background-color: #d97706;
            }
            .footer {
              padding: 24px;
              text-align: center;
              font-size: 14px;
              color: #6b7280;
              border-top: 1px solid #e5e7eb;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📢 You were mentioned</h1>
            </div>
            <div class="content">
              <div class="message">{{message}}</div>
              {{#context}}
              <div class="mention-context">
                "{{context}}"
              </div>
              {{/context}}
              <a href="{{appUrl}}/sparks/{{sparkId}}" class="button">View Discussion</a>
            </div>
            <div class="footer">
              <p>You're receiving this because you were mentioned.</p>
              <p><a href="{{appUrl}}/settings/notifications" style="color: #f59e0b;">Manage notification preferences</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        You were mentioned

        {{message}}

        {{#context}}
        Context: "{{context}}"
        {{/context}}

        View Discussion: {{appUrl}}/sparks/{{sparkId}}

        ---
        Manage preferences: {{appUrl}}/settings/notifications
      `
    });
  }

  // Queue processor
  private startQueueProcessor(): void {
    setInterval(() => {
      this.processQueue();
    }, 2000); // Process every 2 seconds
  }

  // Statistics
  getStats() {
    return {
      ...this.stats,
      queueLength: this.queue.length
    };
  }

  getDeliveryStatus(deliveryId: string) {
    return this.deliveries.get(deliveryId);
  }

  getAllDeliveries(): any[] {
    return Array.from(this.deliveries.values());
  }

  // Health check
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      if (!this.transporter) {
        return { healthy: false, details: { error: 'Transporter not configured' } };
      }

      await this.transporter.verify();
      return {
        healthy: true,
        details: {
          configured: true,
          queueLength: this.queue.length,
          stats: this.getStats()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: (error as Error).message,
          queueLength: this.queue.length
        }
      };
    }
  }

  // Cleanup
  shutdown(): void {
    this.queue = [];
    this.deliveries.clear();
    this.templates.clear();
    if (this.transporter) {
      this.transporter.close();
    }
    this.removeAllListeners();
  }
}

export const emailService = EmailService.getInstance();
