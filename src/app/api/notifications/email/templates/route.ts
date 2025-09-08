import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email/EmailService';
import { z } from 'zod';

const templateSchema = z.object({
  type: z.string().min(1),
  subject: z.string().optional(),
  html: z.string().min(1),
  text: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, ...template } = templateSchema.parse(body);

    emailService.registerTemplate(type, template);

    return NextResponse.json({
      success: true,
      message: `Template '${type}' registered successfully`
    });
  } catch (error) {
    console.error('Email template API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation error',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to register template',
      message: (error as Error).message
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const templateType = searchParams.get('type');
    
    if (templateType) {
      const template = emailService.getTemplate(templateType);
      if (!template) {
        return NextResponse.json({
          success: false,
          error: 'Template not found'
        }, { status: 404 });
      }
      
      return NextResponse.json({
        success: true,
        template: {
          type: templateType,
          ...template
        }
      });
    }

    // Return list of available template types
    const availableTypes = [
      'spark_updated',
      'collaboration_invite', 
      'mention'
    ];
    
    return NextResponse.json({
      success: true,
      availableTypes
    });
  } catch (error) {
    console.error('Email template GET API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get templates'
    }, { status: 500 });
  }
}