import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email/EmailService';
import { z } from 'zod';

const emailConfigSchema = z.object({
  provider: z.enum(['smtp', 'sendgrid', 'ses']),
  from: z.string().email(),
  apiKey: z.string().optional(),
  host: z.string().optional(),
  port: z.number().optional(),
  secure: z.boolean().optional(),
  auth: z.object({
    user: z.string(),
    pass: z.string()
  }).optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const config = emailConfigSchema.parse(body);

    await emailService.configure(config);

    return NextResponse.json({
      success: true,
      message: 'Email service configured successfully'
    });
  } catch (error) {
    console.error('Email config API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation error',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to configure email service',
      message: (error as Error).message
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const health = await emailService.healthCheck();
    
    return NextResponse.json({
      success: true,
      health
    });
  } catch (error) {
    console.error('Email health check API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check email service health'
    }, { status: 500 });
  }
}