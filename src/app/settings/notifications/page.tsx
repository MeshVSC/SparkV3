'use client';

import { NotificationSettings } from '@/components/notifications/NotificationSettings';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NotificationSettingsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Link href="/profile">
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Profile
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Notification Settings</h1>
            <p className="text-muted-foreground mt-1">
              Manage how you receive notifications about sparks, achievements, and collaboration.
            </p>
          </div>

          <NotificationSettings />
        </div>
      </div>
    </div>
  );
}