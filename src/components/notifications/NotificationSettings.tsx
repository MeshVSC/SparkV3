'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, Smartphone, Mail, Monitor, AlertTriangle, CheckCircle } from 'lucide-react';
import { webPushService } from '@/lib/notification/WebPushService';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

interface NotificationPreferences {
  // Global toggles
  emailNotifications: boolean;
  pushNotifications: boolean;
  inAppNotifications: boolean;
  
  // Email notification types
  emailSparkUpdates: boolean;
  emailAchievementAlerts: boolean;
  emailCollaborationNotifications: boolean;
  
  // Push notification types
  pushSparkUpdates: boolean;
  pushAchievementAlerts: boolean;
  pushCollaborationNotifications: boolean;
  
  // In-app notification types
  inAppSparkUpdates: boolean;
  inAppAchievementAlerts: boolean;
  inAppCollaborationNotifications: boolean;
}

export function NotificationSettings() {
  const { data: session } = useSession();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
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
  
  const [pushStatus, setPushStatus] = useState<{
    supported: boolean;
    permission: NotificationPermission;
    subscribed: boolean;
    loading: boolean;
  }>({
    supported: false,
    permission: 'default',
    subscribed: false,
    loading: false
  });
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check push notification support and status
    const checkPushStatus = () => {
      const supported = webPushService.checkBrowserSupport();
      const permission = webPushService.getPermissionStatus();
      
      setPushStatus(prev => ({
        ...prev,
        supported,
        permission
      }));
    };

    checkPushStatus();
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    if (!session?.user?.id) return;

    try {
      const response = await fetch(`/api/users/${session.user.id}/preferences`);
      if (response.ok) {
        const prefs = await response.json();
        setPreferences({
          emailNotifications: prefs.emailNotifications ?? true,
          pushNotifications: prefs.pushNotifications ?? true,
          inAppNotifications: prefs.inAppNotifications ?? true,
          emailSparkUpdates: prefs.emailSparkUpdates ?? true,
          emailAchievementAlerts: prefs.emailAchievementAlerts ?? true,
          emailCollaborationNotifications: prefs.emailCollaborationNotifications ?? true,
          pushSparkUpdates: prefs.pushSparkUpdates ?? true,
          pushAchievementAlerts: prefs.pushAchievementAlerts ?? true,
          pushCollaborationNotifications: prefs.pushCollaborationNotifications ?? true,
          inAppSparkUpdates: prefs.inAppSparkUpdates ?? true,
          inAppAchievementAlerts: prefs.inAppAchievementAlerts ?? true,
          inAppCollaborationNotifications: prefs.inAppCollaborationNotifications ?? true,
        });
        
        // Check if user has push subscription
        if (prefs.pushNotifications && webPushService.getPermissionStatus() === 'granted') {
          setPushStatus(prev => ({ ...prev, subscribed: true }));
        }
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    }
  };

  const savePreferences = async (newPreferences: NotificationPreferences) => {
    if (!session?.user?.id) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/users/${session.user.id}/preferences`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPreferences)
      });

      if (!response.ok) {
        throw new Error('Failed to save preferences');
      }

      setPreferences(newPreferences);
      toast.success('Notification preferences saved');
    } catch (error) {
      console.error('Failed to save preferences:', error);
      toast.error('Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key: keyof NotificationPreferences, value: boolean) => {
    const newPreferences = { ...preferences, [key]: value };
    
    // Auto-disable specific types when global toggle is disabled
    if (key === 'emailNotifications' && !value) {
      newPreferences.emailSparkUpdates = false;
      newPreferences.emailAchievementAlerts = false;
      newPreferences.emailCollaborationNotifications = false;
    } else if (key === 'pushNotifications' && !value) {
      newPreferences.pushSparkUpdates = false;
      newPreferences.pushAchievementAlerts = false;
      newPreferences.pushCollaborationNotifications = false;
    } else if (key === 'inAppNotifications' && !value) {
      newPreferences.inAppSparkUpdates = false;
      newPreferences.inAppAchievementAlerts = false;
      newPreferences.inAppCollaborationNotifications = false;
    }
    
    // Auto-enable global toggle when specific type is enabled
    if (value) {
      if (key.startsWith('email') && key !== 'emailNotifications') {
        newPreferences.emailNotifications = true;
      } else if (key.startsWith('push') && key !== 'pushNotifications') {
        newPreferences.pushNotifications = true;
      } else if (key.startsWith('inApp') && key !== 'inAppNotifications') {
        newPreferences.inAppNotifications = true;
      }
    }
    
    savePreferences(newPreferences);
  };

  const handlePushNotificationSetup = async () => {
    if (!session?.user?.id || !pushStatus.supported) return;

    setPushStatus(prev => ({ ...prev, loading: true }));
    
    try {
      if (pushStatus.permission === 'granted' && preferences.pushNotifications) {
        // Already granted, subscribe user
        await webPushService.subscribeUser(session.user.id);
        setPushStatus(prev => ({ ...prev, subscribed: true }));
        toast.success('Push notifications enabled');
      } else {
        // Request permission
        const permission = await webPushService.requestPermission();
        
        if (permission === 'granted') {
          await webPushService.subscribeUser(session.user.id);
          setPushStatus(prev => ({ 
            ...prev, 
            permission: 'granted', 
            subscribed: true 
          }));
          
          // Enable push notifications in preferences
          const newPreferences = { ...preferences, pushNotifications: true };
          await savePreferences(newPreferences);
          
          toast.success('Push notifications enabled');
        } else {
          toast.error('Push notification permission denied');
        }
      }
    } catch (error: any) {
      console.error('Push notification setup failed:', error);
      
      if (error.message.includes('blocked')) {
        toast.error('Push notifications are blocked. Please enable them in your browser settings.');
      } else {
        toast.error('Failed to set up push notifications');
      }
    } finally {
      setPushStatus(prev => ({ ...prev, loading: false }));
    }
  };

  const handlePushNotificationDisable = async () => {
    if (!session?.user?.id) return;

    setPushStatus(prev => ({ ...prev, loading: true }));
    
    try {
      await webPushService.unsubscribeUser(session.user.id);
      setPushStatus(prev => ({ ...prev, subscribed: false }));
      
      // Disable push notifications in preferences
      const newPreferences = { 
        ...preferences, 
        pushNotifications: false,
        pushSparkUpdates: false,
        pushAchievementAlerts: false,
        pushCollaborationNotifications: false
      };
      await savePreferences(newPreferences);
      
      toast.success('Push notifications disabled');
    } catch (error) {
      console.error('Failed to disable push notifications:', error);
      toast.error('Failed to disable push notifications');
    } finally {
      setPushStatus(prev => ({ ...prev, loading: false }));
    }
  };

  const getBrowserSupportMessage = () => {
    if (!pushStatus.supported) {
      return 'Your browser doesn\'t support push notifications. Try using Chrome, Firefox, Safari, or Edge.';
    }
    
    if (pushStatus.permission === 'denied') {
      return 'Push notifications are blocked. You can enable them in your browser settings.';
    }
    
    return null;
  };

  const getPushStatusBadge = () => {
    if (!pushStatus.supported) {
      return <Badge variant="destructive">Not Supported</Badge>;
    }
    
    if (pushStatus.permission === 'denied') {
      return <Badge variant="destructive">Blocked</Badge>;
    }
    
    if (pushStatus.subscribed) {
      return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Enabled</Badge>;
    }
    
    if (pushStatus.permission === 'granted') {
      return <Badge variant="secondary">Available</Badge>;
    }
    
    return <Badge variant="outline">Not Set Up</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notification Settings
          </CardTitle>
          <CardDescription>
            Choose how you want to be notified about spark updates, achievements, and collaboration activity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Push Notifications Setup */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-muted-foreground" />
                <div>
                  <h3 className="font-medium">Push Notifications</h3>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications even when the app is closed
                  </p>
                </div>
              </div>
              {getPushStatusBadge()}
            </div>
            
            {getBrowserSupportMessage() && (
              <Alert>
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  {getBrowserSupportMessage()}
                </AlertDescription>
              </Alert>
            )}
            
            {pushStatus.supported && (
              <div className="flex gap-2">
                {!pushStatus.subscribed && pushStatus.permission !== 'denied' && (
                  <Button
                    onClick={handlePushNotificationSetup}
                    disabled={pushStatus.loading}
                    size="sm"
                  >
                    {pushStatus.loading ? 'Setting up...' : 'Enable Push Notifications'}
                  </Button>
                )}
                
                {pushStatus.subscribed && (
                  <Button
                    variant="outline"
                    onClick={handlePushNotificationDisable}
                    disabled={pushStatus.loading}
                    size="sm"
                  >
                    {pushStatus.loading ? 'Disabling...' : 'Disable Push Notifications'}
                  </Button>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Global Notification Toggles */}
          <div className="space-y-4">
            <h3 className="font-medium">Notification Channels</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Monitor className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">In-App Notifications</div>
                    <div className="text-sm text-muted-foreground">Show notifications within the application</div>
                  </div>
                </div>
                <Switch
                  checked={preferences.inAppNotifications}
                  onCheckedChange={(value) => handleToggle('inAppNotifications', value)}
                  disabled={loading}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Email Notifications</div>
                    <div className="text-sm text-muted-foreground">Send notifications to your email address</div>
                  </div>
                </div>
                <Switch
                  checked={preferences.emailNotifications}
                  onCheckedChange={(value) => handleToggle('emailNotifications', value)}
                  disabled={loading}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Push Notifications</div>
                    <div className="text-sm text-muted-foreground">Send notifications to your device</div>
                  </div>
                </div>
                <Switch
                  checked={preferences.pushNotifications && pushStatus.subscribed}
                  onCheckedChange={(value) => handleToggle('pushNotifications', value)}
                  disabled={loading || !pushStatus.supported || !pushStatus.subscribed}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Detailed Notification Types */}
          <div className="space-y-4">
            <h3 className="font-medium">Notification Types</h3>
            
            {/* Spark Updates */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Spark Updates</h4>
              <div className="ml-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">In-app notifications</span>
                  <Switch
                    checked={preferences.inAppSparkUpdates}
                    onCheckedChange={(value) => handleToggle('inAppSparkUpdates', value)}
                    disabled={loading || !preferences.inAppNotifications}
                    size="sm"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Email notifications</span>
                  <Switch
                    checked={preferences.emailSparkUpdates}
                    onCheckedChange={(value) => handleToggle('emailSparkUpdates', value)}
                    disabled={loading || !preferences.emailNotifications}
                    size="sm"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Push notifications</span>
                  <Switch
                    checked={preferences.pushSparkUpdates}
                    onCheckedChange={(value) => handleToggle('pushSparkUpdates', value)}
                    disabled={loading || !preferences.pushNotifications || !pushStatus.subscribed}
                    size="sm"
                  />
                </div>
              </div>
            </div>

            {/* Achievement Alerts */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Achievement Alerts</h4>
              <div className="ml-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">In-app notifications</span>
                  <Switch
                    checked={preferences.inAppAchievementAlerts}
                    onCheckedChange={(value) => handleToggle('inAppAchievementAlerts', value)}
                    disabled={loading || !preferences.inAppNotifications}
                    size="sm"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Email notifications</span>
                  <Switch
                    checked={preferences.emailAchievementAlerts}
                    onCheckedChange={(value) => handleToggle('emailAchievementAlerts', value)}
                    disabled={loading || !preferences.emailNotifications}
                    size="sm"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Push notifications</span>
                  <Switch
                    checked={preferences.pushAchievementAlerts}
                    onCheckedChange={(value) => handleToggle('pushAchievementAlerts', value)}
                    disabled={loading || !preferences.pushNotifications || !pushStatus.subscribed}
                    size="sm"
                  />
                </div>
              </div>
            </div>

            {/* Collaboration Notifications */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Collaboration</h4>
              <div className="ml-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">In-app notifications</span>
                  <Switch
                    checked={preferences.inAppCollaborationNotifications}
                    onCheckedChange={(value) => handleToggle('inAppCollaborationNotifications', value)}
                    disabled={loading || !preferences.inAppNotifications}
                    size="sm"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Email notifications</span>
                  <Switch
                    checked={preferences.emailCollaborationNotifications}
                    onCheckedChange={(value) => handleToggle('emailCollaborationNotifications', value)}
                    disabled={loading || !preferences.emailNotifications}
                    size="sm"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Push notifications</span>
                  <Switch
                    checked={preferences.pushCollaborationNotifications}
                    onCheckedChange={(value) => handleToggle('pushCollaborationNotifications', value)}
                    disabled={loading || !preferences.pushNotifications || !pushStatus.subscribed}
                    size="sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {loading && (
            <div className="text-center py-4">
              <div className="text-sm text-muted-foreground">Saving preferences...</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}