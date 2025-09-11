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

    // Only allow users to fetch their own preferences
    if (session.user.id !== params.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const preferences = await prisma.userPreferences.findUnique({
      where: { userId: params.userId }
    });

    return NextResponse.json(preferences || {
      emailNotifications: true,
      pushNotifications: true,
      inAppNotifications: true,
      emailSparkUpdates: true,
      emailAchievementAlerts: true,
      emailCollaborationNotifications: true,
      pushSparkUpdates: true,
      pushAchievementAlerts: true,
      pushCollaborationNotifications: true,
      inAppSparkUpdates: true,
      inAppAchievementAlerts: true,
      inAppCollaborationNotifications: true,
    });
  } catch (error) {
    console.error('Failed to fetch user preferences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow users to update their own preferences
    if (session.user.id !== params.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updates = await request.json();
    
    // Validate the updates contain only allowed fields
    const allowedFields = [
      'emailNotifications',
      'pushNotifications', 
      'inAppNotifications',
      'emailSparkUpdates',
      'emailAchievementAlerts',
      'emailCollaborationNotifications',
      'pushSparkUpdates',
      'pushAchievementAlerts',
      'pushCollaborationNotifications',
      'inAppSparkUpdates',
      'inAppAchievementAlerts',
      'inAppCollaborationNotifications'
    ];

    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key];
        return obj;
      }, {} as any);

    const preferences = await prisma.userPreferences.upsert({
      where: { userId: params.userId },
      create: {
        userId: params.userId,
        ...filteredUpdates
      },
      update: filteredUpdates
    });

    return NextResponse.json(preferences);
  } catch (error) {
    console.error('Failed to update user preferences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}