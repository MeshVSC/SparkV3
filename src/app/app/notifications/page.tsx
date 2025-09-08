'use client';

import { NotificationHistory } from '@/components/notifications/NotificationHistory';
import { useSession } from 'next-auth/react';

export default function NotificationsPage() {
  const { data: session } = useSession();

  return (
    <div className="container mx-auto py-6 px-4">
      <NotificationHistory userId={session?.user?.id} />
    </div>
  );
}