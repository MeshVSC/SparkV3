import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email/EmailService';
import { z } from 'zod';

const sendEmailSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  subject: z.string().min(1),
  template: z.string().min(1),
  data: z.record(z.string(), z.any()).optional().default({}),
  priority: z.enum(['high', 'medium', 'low']).optional().default('medium'),
  scheduledAt: z.string().datetime().optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, subject, template, data, priority, scheduledAt } = sendEmailSchema.parse(body);

    const options: any = { priority };
    if (scheduledAt) {
      options.scheduledAt = new Date(scheduledAt);
    }

    const emailId = await emailService.sendEmail(
      to,
      subject,
      template,
      data
    );

    return NextResponse.json({
      success: true,
      emailId,
      message: 'Email queued successfully'
    });
  } catch (error) {
    console.error('Email send API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation error',
        details: error.issues
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to send email',
      message: (error as Error).message
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const stats = emailService.getStats();
    const deliveries = emailService.getAllDeliveries();
    
    return NextResponse.json({
      stats,
      recentDeliveries: deliveries.slice(-10) // Last 10 deliveries
    });
  } catch (error) {
    console.error('Email stats API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get email stats'
    }, { status: 500 });
  }
}