'use client';

import React from 'react';
import { Bell, Check, X, History, MoreHorizontal } from 'lucide-react';
import { useNotifications, useNotificationPermission } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

interface NotificationDropdownProps {
  userId?: string;
}

export function NotificationDropdown({ userId }: NotificationDropdownProps) {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAllNotifications,
    isConnected
  } = useNotifications(userId);

  const { permission, requestPermission } = useNotificationPermission();

  const handleNotificationClick = (notificationId: string, notification: any) => {
    markAsRead(notificationId);
    
    // Handle action based on notification type/data
    if (notification.data?.action && typeof window !== 'undefined') {
      const { action, sparkId, url } = notification.data;
      
      if (action === 'navigate' && url) {
        window.location.href = url;
      } else if (sparkId) {
        window.location.href = `/app/sparks/${sparkId}`;
      }
    }
  };

  // Show only recent notifications (last 10)
  const recentNotifications = notifications.slice(0, 10);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Notifications</h3>
            {!isConnected && (
              <div className="w-2 h-2 bg-yellow-500 rounded-full" title="Offline" />
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {permission !== 'granted' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={requestPermission}
                className="text-xs"
              >
                Enable
              </Button>
            )}
            
            {recentNotifications.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={markAllAsRead}>
                    <Check className="h-4 w-4 mr-2" />
                    Mark all as read
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={clearAllNotifications} className="text-destructive">
                    <X className="h-4 w-4 mr-2" />
                    Clear all
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <DropdownMenuSeparator />

        <ScrollArea className="h-96">
          {recentNotifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {recentNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-3 rounded-lg cursor-pointer transition-all duration-200 border group",
                    notification.read 
                      ? "bg-muted/30 border-transparent hover:bg-muted/50" 
                      : "bg-card border-primary/20 shadow-sm hover:shadow-md hover:border-primary/40"
                  )}
                  onClick={() => handleNotificationClick(notification.id, notification)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <NotificationTypeIcon type={notification.type} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className={cn(
                          "text-sm font-medium truncate",
                          !notification.read && "text-primary"
                        )}>
                          {notification.title}
                        </h4>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                        )}
                      </div>
                      
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {notification.message}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </span>
                        
                        {notification.data?.actions && (
                          <div className="flex gap-1">
                            {notification.data.actions.map((action: any, index: number) => (
                              <Button
                                key={index}
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (action.handler) {
                                    action.handler();
                                  }
                                }}
                              >
                                {action.label}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearNotification(notification.id);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <Link href="/app/notifications" passHref>
              <DropdownMenuItem className="justify-center text-sm font-medium cursor-pointer">
                <History className="h-4 w-4 mr-2" />
                View All Notifications
              </DropdownMenuItem>
            </Link>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationTypeIcon({ type }: { type: string }) {
  const baseClasses = "w-6 h-6 rounded-full flex items-center justify-center text-sm";
  
  switch (type) {
    case 'achievement_unlocked':
      return <div className={cn(baseClasses, "bg-yellow-100 text-yellow-600")}>🏆</div>;
    case 'spark_update':
      return <div className={cn(baseClasses, "bg-green-100 text-green-600")}>✨</div>;
    case 'collaboration_invite':
      return <div className={cn(baseClasses, "bg-blue-100 text-blue-600")}>🤝</div>;
    case 'collaboration_action':
      return <div className={cn(baseClasses, "bg-purple-100 text-purple-600")}>👥</div>;
    case 'system':
      return <div className={cn(baseClasses, "bg-gray-100 text-gray-600")}>ℹ️</div>;
    case 'success':
      return <div className={cn(baseClasses, "bg-green-100 text-green-600")}>✅</div>;
    case 'warning':
      return <div className={cn(baseClasses, "bg-yellow-100 text-yellow-600")}>⚠️</div>;
    case 'error':
      return <div className={cn(baseClasses, "bg-red-100 text-red-600")}>❌</div>;
    case 'info':
      return <div className={cn(baseClasses, "bg-blue-100 text-blue-600")}>ℹ️</div>;
    default:
      return (
        <div className={cn(baseClasses, "bg-muted")}>
          <Bell className="h-3 w-3" />
        </div>
      );
  }
}