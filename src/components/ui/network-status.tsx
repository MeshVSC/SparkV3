'use client';

import React from 'react';
import { AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNetworkStatus } from '@/lib/pwa';
import { cn } from '@/lib/utils';

interface NetworkStatusProps {
  className?: string;
  showWhenOnline?: boolean;
}

export function NetworkStatus({ className, showWhenOnline = false }: NetworkStatusProps) {
  const isOnline = useNetworkStatus();
  
  // Only show when offline or when explicitly requested to show online status
  if (isOnline && !showWhenOnline) {
    return null;
  }

  return (
    <Alert
      className={cn(
        'transition-all duration-300',
        isOnline 
          ? 'border-green-200 bg-green-50 text-green-800'
          : 'border-orange-200 bg-orange-50 text-orange-800',
        className
      )}
    >
      {isOnline ? (
        <Wifi className="h-4 w-4" />
      ) : (
        <WifiOff className="h-4 w-4" />
      )}
      <AlertDescription>
        {isOnline 
          ? 'You\'re back online! All features are available.'
          : 'You\'re currently offline. Some features may be limited.'
        }
      </AlertDescription>
    </Alert>
  );
}

// Floating network status indicator
export function NetworkIndicator({ className }: { className?: string }) {
  const isOnline = useNetworkStatus();

  return (
    <div 
      className={cn(
        'fixed top-4 right-4 z-50 rounded-full p-2 shadow-lg transition-all duration-300',
        isOnline 
          ? 'bg-green-500 text-white'
          : 'bg-orange-500 text-white animate-pulse',
        className
      )}
      title={isOnline ? 'Online' : 'Offline'}
    >
      {isOnline ? (
        <Wifi className="h-4 w-4" />
      ) : (
        <WifiOff className="h-4 w-4" />
      )}
    </div>
  );
}

// Hook for network-dependent UI updates
export function useNetworkDependentState<T>(onlineValue: T, offlineValue: T): T {
  const isOnline = useNetworkStatus();
  return isOnline ? onlineValue : offlineValue;
}