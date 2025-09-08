import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email/EmailService';
import { EmailWebhookEvent } from '@/types/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const authHeader = request.headers.get('authorization');
    
    // Basic webhook authentication (in production, use proper verification)
    const expectedAuth = process.env.EMAIL_WEBHOOK_SECRET;
    if (expectedAuth && authHeader !== `Bearer ${expectedAuth}`) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    // Process webhook events based on provider
    const provider = request.headers.get('x-provider') || 'generic';
    
    let events: EmailWebhookEvent[] = [];
    
    switch (provider) {
      case 'sendgrid':
        events = processSendGridWebhook(body);
        break;
      case 'ses':
        events = processSESWebhook(body);
        break;
      default:
        events = processGenericWebhook(body);
    }

    // Process each event
    for (const event of events) {
      await processWebhookEvent(event);
    }

    return NextResponse.json({
      success: true,
      processed: events.length
    });
  } catch (error) {
    console.error('Email webhook processing error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process webhook'
    }, { status: 500 });
  }
}

function processSendGridWebhook(body: any[]): EmailWebhookEvent[] {
  return body.map((event: any) => ({
    type: mapSendGridEventType(event.event),
    messageId: event.sg_message_id,
    email: event.email,
    timestamp: new Date(event.timestamp * 1000),
    data: {
      reason: event.reason,
      bounce_classification: event.bounce_classification,
      url: event.url,
      useragent: event.useragent
    }
  }));
}

function processSESWebhook(body: any): EmailWebhookEvent[] {
  const message = JSON.parse(body.Message);
  const eventType = message.eventType;
  
  return [{
    type: mapSESEventType(eventType),
    messageId: message.mail.messageId,
    email: message.mail.destination[0],
    timestamp: new Date(message.mail.timestamp),
    data: {
      bounceType: message.bounce?.bounceType,
      bounceSubType: message.bounce?.bounceSubType,
      complaintFeedbackType: message.complaint?.complaintFeedbackType
    }
  }];
}

function processGenericWebhook(body: any): EmailWebhookEvent[] {
  if (Array.isArray(body)) {
    return body.map(processGenericEvent);
  }
  return [processGenericEvent(body)];
}

function processGenericEvent(event: any): EmailWebhookEvent {
  return {
    type: event.type || 'delivered',
    messageId: event.messageId || event.id,
    email: event.email || event.recipient,
    timestamp: new Date(event.timestamp || event.time || Date.now()),
    data: event.data || {}
  };
}

function mapSendGridEventType(eventType: string): EmailWebhookEvent['type'] {
  const mapping: Record<string, EmailWebhookEvent['type']> = {
    'delivered': 'delivered',
    'open': 'opened',
    'click': 'clicked',
    'bounce': 'bounced',
    'dropped': 'bounced',
    'spamreport': 'complaint',
    'unsubscribe': 'complaint'
  };
  return mapping[eventType] || 'delivered';
}

function mapSESEventType(eventType: string): EmailWebhookEvent['type'] {
  const mapping: Record<string, EmailWebhookEvent['type']> = {
    'delivery': 'delivered',
    'bounce': 'bounced',
    'complaint': 'complaint'
  };
  return mapping[eventType] || 'delivered';
}

async function processWebhookEvent(event: EmailWebhookEvent): Promise<void> {
  try {
    console.log('Processing email webhook event:', {
      type: event.type,
      messageId: event.messageId,
      email: event.email
    });

    // Update delivery status in the email service
    // This would typically update a database record
    
    // Emit event for other services to listen to
    emailService.emit('webhook_event', event);
    
    // Handle specific event types
    switch (event.type) {
      case 'bounced':
        console.log('Email bounced:', event.email, event.data?.reason);
        // Could add email to bounce list, notify administrators, etc.
        break;
      case 'complaint':
        console.log('Spam complaint received for:', event.email);
        // Could automatically unsubscribe, notify administrators, etc.
        break;
      case 'opened':
        // Track engagement metrics
        break;
      case 'clicked':
        // Track click-through rates
        break;
    }
  } catch (error) {
    console.error('Error processing webhook event:', error);
  }
}