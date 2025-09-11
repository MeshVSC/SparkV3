import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { subscriptionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // In production, you would:
    // 1. Verify the subscription belongs to the authenticated user
    // 2. Delete the subscription from the database
    
    /*
    const subscription = await prisma.pushSubscription.findUnique({
      where: { id: params.subscriptionId }
    });
    
    if (!subscription || subscription.userId !== session.user.id) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }
    
    await prisma.pushSubscription.delete({
      where: { id: params.subscriptionId }
    });
    */

    console.log(`Mock: Removed subscription ${params.subscriptionId} for user ${session.user.id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete subscription:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}