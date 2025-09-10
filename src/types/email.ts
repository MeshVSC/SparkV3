import { SendMailOptions } from 'nodemailer';

export interface EmailTemplate {
  subject?: string;
  html: string;
  text?: string;
}

export interface EmailConfig {
  provider: 'smtp' | 'sendgrid' | 'ses' | 'mailgun';
  from: string;
  apiKey?: string;
  domain?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
}

export interface EmailQueue {
  id: string;
  to: string[];
  subject: string;
  templateType: string;
  templateData: Record<string, any>;
  priority: 'high' | 'medium' | 'low';
  attempts: number;
  scheduledAt: Date;
  createdAt: Date;
  options?: Partial<SendMailOptions>;
}

export enum DeliveryStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  BOUNCED = 'bounced'
}

export interface EmailDelivery {
  id: string;
  emailId: string;
  to: string;
  status: DeliveryStatus;
  attempts: number;
  lastAttemptAt?: Date;
  deliveredAt?: Date;
  errorMessage?: string;
  providerMessageId?: string;
  bounceReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailStats {
  sent: number;
  failed: number;
  pending: number;
  processing: number;
  queueLength: number;
  deliveryRate: number;
  bounceRate: number;
}

export interface EmailWebhookEvent {
  type: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complaint';
  messageId: string;
  email: string;
  timestamp: Date;
  data?: Record<string, any>;
}
