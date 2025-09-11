import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow users to fetch their own subscriptions
    if (session.user.id !== params.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // For now, return mock subscription data based on user preferences
    // In production, you would fetch from a dedicated push_subscriptions table
    const userPrefs = await prisma.userPreferences.findUnique({
      where: { userId: params.userId }
    });

    if (!userPrefs?.pushNotifications) {
      return NextResponse.json([]);
    }

    const subscriptions = [{
      id: `subscription-${params.userId}`,
      userId: params.userId,
      endpoint: `mock-endpoint-${params.userId}`,
      p256dh: 'mock-p256dh',
      auth: 'mock-auth',
      createdAt: new Date(),
      updatedAt: new Date()
    }];

    return NextResponse.json(subscriptions);
  } catch (error) {
    console.error('Failed to fetch user subscriptions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow users to delete their own subscriptions
    if (session.user.id !== params.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Remove push notification flag from user preferences
    await prisma.userPreferences.updateMany({
      where: { userId: params.userId },
      data: { pushNotifications: false }
    });

    // In production, you would delete from a dedicated push_subscriptions table:
    /*
    await prisma.pushSubscription.deleteMany({
      where: { userId: params.userId }
    });
    */

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete user subscriptions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}