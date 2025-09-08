'use client';

import React, { useEffect, useState } from 'react';
import { X, Bell, Check, AlertTriangle, Info, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/hooks/useNotifications';
import { toast } from '@/hooks/use-toast';

interface ToastNotification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error' | string;
  timestamp: string;
  data?: Record<string, any>;
}

interface ToastNotificationProps {
  userId?: string;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  autoHideDuration?: number;
  maxToasts?: number;
  useIntegratedToast?: boolean;
}

export function ToastNotification({
  userId,
  position = 'top-right',
  autoHideDuration = 5000,
  maxToasts = 3,
  useIntegratedToast = false
}: ToastNotificationProps) {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const { notifications, markAsRead } = useNotifications(userId);

  // Listen for new notifications and show as toasts
  useEffect(() => {
    if (notifications.length === 0) return;

    const latestNotification = notifications[0];
    if (!latestNotification.read) {
      const toastData: ToastNotification = {
        id: latestNotification.id,
        title: latestNotification.title,
        message: latestNotification.message,
        type: latestNotification.type,
        timestamp: latestNotification.createdAt,
        data: latestNotification.data
      };

      if (useIntegratedToast) {
        // Use existing toast system
        toast({
          title: toastData.title,
          description: toastData.message,
          variant: getToastVariant(toastData.type),
          duration: autoHideDuration,
        });
        markAsRead(toastData.id);
      } else {
        // Use custom toast implementation
        setToasts(prev => {
          // Check if toast already exists
          if (prev.some(t => t.id === toastData.id)) {
            return prev;
          }
          
          // Add new toast and limit to maxToasts
          return [toastData, ...prev.slice(0, maxToasts - 1)];
        });

        // Auto-hide toast
        if (autoHideDuration > 0) {
          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== toastData.id));
          }, autoHideDuration);
        }
      }
    }
  }, [notifications, maxToasts, autoHideDuration, useIntegratedToast, markAsRead]);

  const dismissToast = (toastId: string) => {
    setToasts(prev => prev.filter(t => t.id !== toastId));
    markAsRead(toastId);
  };

  const handleToastClick = (toast: ToastNotification) => {
    markAsRead(toast.id);
    dismissToast(toast.id);
    
    // Handle navigation based on notification type/data
    if (toast.data?.action) {
      const { action, sparkId, url } = toast.data;
      
      if (action === 'navigate' && url) {
        window.location.href = url;
      } else if (sparkId) {
        window.location.href = `/app/sparks/${sparkId}`;
      }
    }
  };

  if (useIntegratedToast || toasts.length === 0) return null;

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4'
  };

  return (
    <div className={cn(
      'fixed z-50 flex flex-col gap-3 pointer-events-none',
      positionClasses[position]
    )}>
      {toasts.map((toastItem, index) => (
        <div
          key={toastItem.id}
          className={cn(
            'pointer-events-auto max-w-sm w-full rounded-lg shadow-lg transition-all duration-300',
            'animate-in slide-in-from-top-5',
            getToastStyles(toastItem.type),
            'hover:shadow-xl cursor-pointer transform hover:scale-[1.02]'
          )}
          style={{
            animationDelay: `${index * 100}ms`
          }}
          onClick={() => handleToastClick(toastItem)}
        >
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <NotificationTypeIcon type={toastItem.type} size="md" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold mb-1 line-clamp-1">
                  {toastItem.title}
                </h4>
                <p className="text-sm opacity-90 line-clamp-2">
                  {toastItem.message}
                </p>
                
                {toastItem.data?.actions && (
                  <div className="flex gap-2 mt-3">
                    {toastItem.data.actions.map((action: any, actionIndex: number) => (
                      <Button
                        key={actionIndex}
                        variant="secondary"
                        size="sm"
                        className="h-7 px-3 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (action.handler) {
                            action.handler();
                          }
                          dismissToast(toastItem.id);
                        }}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0 opacity-60 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  dismissToast(toastItem.id);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Progress bar for auto-hide */}
          {autoHideDuration > 0 && (
            <div className="h-1 bg-black/10 rounded-b-lg overflow-hidden">
              <div 
                className="h-full bg-white/30 transition-all duration-linear"
                style={{
                  animation: `shrink ${autoHideDuration}ms linear forwards`
                }}
              />
            </div>
          )}
        </div>
      ))}

      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}

function NotificationTypeIcon({ 
  type, 
  size = 'sm' 
}: { 
  type: string; 
  size?: 'sm' | 'md' 
}) {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6'
  };

  const iconClass = cn('flex-shrink-0', sizeClasses[size]);

  switch (type) {
    case 'success':
      return <Check className={cn(iconClass, 'text-white')} />;
    case 'error':
      return <XCircle className={cn(iconClass, 'text-white')} />;
    case 'warning':
      return <AlertTriangle className={cn(iconClass, 'text-white')} />;
    case 'info':
      return <Info className={cn(iconClass, 'text-white')} />;
    case 'achievement_unlocked':
      return <div className={cn(iconClass, 'text-white flex items-center justify-center text-lg')}>🏆</div>;
    case 'spark_update':
      return <div className={cn(iconClass, 'text-white flex items-center justify-center text-lg')}>✨</div>;
    case 'collaboration_invite':
      return <div className={cn(iconClass, 'text-white flex items-center justify-center text-lg')}>🤝</div>;
    case 'collaboration_action':
      return <div className={cn(iconClass, 'text-white flex items-center justify-center text-lg')}>👥</div>;
    case 'system':
      return <Info className={cn(iconClass, 'text-white')} />;
    default:
      return <Bell className={cn(iconClass, 'text-white')} />;
  }
}

function getToastStyles(type: string): string {
  switch (type) {
    case 'success':
      return 'bg-green-500 text-white border border-green-600';
    case 'error':
      return 'bg-red-500 text-white border border-red-600';
    case 'warning':
      return 'bg-yellow-500 text-white border border-yellow-600';
    case 'info':
      return 'bg-blue-500 text-white border border-blue-600';
    case 'achievement_unlocked':
      return 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white border border-yellow-600';
    case 'spark_update':
      return 'bg-gradient-to-r from-green-500 to-emerald-500 text-white border border-green-600';
    case 'collaboration_invite':
      return 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white border border-blue-600';
    case 'collaboration_action':
      return 'bg-gradient-to-r from-purple-500 to-violet-500 text-white border border-purple-600';
    case 'system':
      return 'bg-gray-500 text-white border border-gray-600';
    default:
      return 'bg-background text-foreground border';
  }
}

function getToastVariant(type: string): 'default' | 'destructive' {
  return type === 'error' ? 'destructive' : 'default';
}