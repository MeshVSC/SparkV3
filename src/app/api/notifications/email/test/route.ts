import { NextRequest, NextResponse } from 'next/server';
import { emailServiceIntegration } from '@/lib/email/EmailServiceIntegration';
import { z } from 'zod';

const testEmailSchema = z.object({
  to: z.string().email(),
  type: z.enum(['spark_updated', 'collaboration_invite', 'mention', 'generic']).optional().default('generic')
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, type } = testEmailSchema.parse(body);

    let emailId: string;

    switch (type) {
      case 'spark_updated':
        emailId = await emailServiceIntegration.sendSparkUpdateEmail('test-user-123', {
          id: 'test-spark-456',
          title: 'My Test Spark'
        });
        break;
        
      case 'collaboration_invite':
        emailId = await emailServiceIntegration.sendCollaborationInviteEmail(
          'test-user-123',
          { id: 'test-inviter-789', name: 'John Doe' },
          { id: 'test-spark-456', title: 'Collaboration Test Spark' }
        );
        break;
        
      case 'mention':
        emailId = await emailServiceIntegration.sendMentionEmail(
          'test-user-123',
          { id: 'test-mentioner-101', name: 'Jane Smith' },
          { id: 'test-spark-456', title: 'Mention Test Spark' },
          'Hey @user, what do you think about this idea?'
        );
        break;
        
      default:
        emailId = await emailServiceIntegration.sendTestEmail(to);
    }

    return NextResponse.json({
      success: true,
      emailId,
      message: `Test email (${type}) queued successfully`,
      recipient: to
    });
  } catch (error) {
    console.error('Test email API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation error',
        details: error.issues
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to send test email',
      message: (error as Error).message
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const health = await emailServiceIntegration.getHealthStatus();
    
    return NextResponse.json({
      success: true,
      health,
      availableTestTypes: [
        'spark_updated',
        'collaboration_invite',
        'mention',
        'generic'
      ]
    });
  } catch (error) {
    console.error('Email health check API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get email service health'
    }, { status: 500 });
  }
}