import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscription = await request.json();
    
    if (!subscription.endpoint || !subscription.p256dh || !subscription.auth) {
      return NextResponse.json({ error: 'Invalid subscription data' }, { status: 400 });
    }

    // Store subscription in database (extend Prisma schema as needed)
    // For now, we'll use the user preferences table to store a flag
    await prisma.userPreferences.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        pushNotifications: true
      },
      update: {
        pushNotifications: true
      }
    });

    // In a production app, you would store the full subscription in a dedicated table:
    /*
    await prisma.pushSubscription.create({
      data: {
        userId: session.user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        userAgent: subscription.userAgent
      }
    });
    */

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to store push subscription:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For now, return mock subscription data
    // In production, you would fetch from a dedicated push_subscriptions table
    const subscriptions = [{
      id: `subscription-${session.user.id}`,
      userId: session.user.id,
      endpoint: `mock-endpoint-${session.user.id}`,
      p256dh: 'mock-p256dh',
      auth: 'mock-auth',
      createdAt: new Date(),
      updatedAt: new Date()
    }];

    return NextResponse.json(subscriptions);
  } catch (error) {
    console.error('Failed to fetch push subscriptions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}