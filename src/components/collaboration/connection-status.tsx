import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ConnectionStatus as Status } from '@/lib/socket-client';
import { Wifi, WifiOff, RotateCcw, AlertTriangle } from 'lucide-react';

interface ConnectionStatusProps {
  status: Status;
  onReconnect?: () => void;
  showLabel?: boolean;
  variant?: 'badge' | 'button' | 'icon';
}

const getStatusConfig = (status: Status) => {
  switch (status) {
    case 'connected':
      return {
        icon: Wifi,
        label: 'Connected',
        color: 'bg-green-500',
        badgeVariant: 'default' as const,
        className: 'text-green-500'
      };
    case 'connecting':
      return {
        icon: RotateCcw,
        label: 'Connecting...',
        color: 'bg-blue-500',
        badgeVariant: 'secondary' as const,
        className: 'text-blue-500 animate-spin'
      };
    case 'reconnecting':
      return {
        icon: RotateCcw,
        label: 'Reconnecting...',
        color: 'bg-yellow-500',
        badgeVariant: 'secondary' as const,
        className: 'text-yellow-500 animate-spin'
      };
    case 'disconnected':
      return {
        icon: WifiOff,
        label: 'Disconnected',
        color: 'bg-gray-500',
        badgeVariant: 'secondary' as const,
        className: 'text-gray-500'
      };
    case 'error':
      return {
        icon: AlertTriangle,
        label: 'Connection Error',
        color: 'bg-red-500',
        badgeVariant: 'destructive' as const,
        className: 'text-red-500'
      };
    default:
      return {
        icon: WifiOff,
        label: 'Unknown',
        color: 'bg-gray-500',
        badgeVariant: 'secondary' as const,
        className: 'text-gray-500'
      };
  }
};

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  status,
  onReconnect,
  showLabel = true,
  variant = 'badge'
}) => {
  const config = getStatusConfig(status);
  const Icon = config.icon;
  const canReconnect = status === 'disconnected' || status === 'error';

  if (variant === 'icon') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative">
              <Icon className={`w-4 h-4 ${config.className}`} />
              <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${config.color}`} />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              <div className="font-medium">{config.label}</div>
              {canReconnect && onReconnect && (
                <div className="text-muted-foreground">Click to reconnect</div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === 'button') {
    return (
      <Button
        variant={status === 'connected' ? 'ghost' : 'outline'}
        size="sm"
        onClick={canReconnect ? onReconnect : undefined}
        disabled={status === 'connecting' || status === 'reconnecting'}
        className="gap-2"
      >
        <Icon className={`w-4 h-4 ${config.className}`} />
        {showLabel && config.label}
      </Button>
    );
  }

  return (
    <Badge
      variant={config.badgeVariant}
      className="gap-1.5 cursor-pointer"
      onClick={canReconnect ? onReconnect : undefined}
    >
      <Icon className={`w-3 h-3 ${config.className}`} />
      {showLabel && config.label}
    </Badge>
  );
};