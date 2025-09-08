import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { UserPresence } from '@/lib/socket-client';
import { formatDistanceToNow } from 'date-fns';

interface PresenceIndicatorProps {
  users: UserPresence[];
  maxVisible?: number;
  showStatus?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const getStatusColor = (status: 'online' | 'idle' | 'away') => {
  switch (status) {
    case 'online':
      return 'bg-green-500';
    case 'idle':
      return 'bg-yellow-500';
    case 'away':
      return 'bg-gray-500';
    default:
      return 'bg-gray-500';
  }
};

const getAvatarSize = (size: 'sm' | 'md' | 'lg') => {
  switch (size) {
    case 'sm':
      return 'w-6 h-6';
    case 'md':
      return 'w-8 h-8';
    case 'lg':
      return 'w-10 h-10';
    default:
      return 'w-8 h-8';
  }
};

const getStatusSize = (size: 'sm' | 'md' | 'lg') => {
  switch (size) {
    case 'sm':
      return 'w-2 h-2';
    case 'md':
      return 'w-2.5 h-2.5';
    case 'lg':
      return 'w-3 h-3';
    default:
      return 'w-2.5 h-2.5';
  }
};

export const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({
  users,
  maxVisible = 5,
  showStatus = true,
  size = 'md'
}) => {
  const visibleUsers = users.slice(0, maxVisible);
  const remainingCount = users.length - maxVisible;

  return (
    <TooltipProvider>
      <div className="flex -space-x-2">
        {visibleUsers.map((user) => (
          <Tooltip key={user.userId}>
            <TooltipTrigger>
              <div className="relative">
                <Avatar className={`border-2 border-background ${getAvatarSize(size)}`}>
                  <AvatarImage src={user.avatar} alt={user.username} />
                  <AvatarFallback className="text-xs">
                    {user.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {showStatus && (
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-background ${getStatusSize(size)} ${getStatusColor(user.status)}`}
                  />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-sm">
                <div className="font-medium">{user.username}</div>
                <div className="text-muted-foreground capitalize">
                  {user.status}
                  {user.status !== 'online' && (
                    <span className="ml-1">
                      ({formatDistanceToNow(new Date(user.lastSeen), { addSuffix: true })})
                    </span>
                  )}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
        
        {remainingCount > 0 && (
          <Tooltip>
            <TooltipTrigger>
              <div className={`flex items-center justify-center rounded-full bg-muted border-2 border-background ${getAvatarSize(size)}`}>
                <span className="text-xs font-medium text-muted-foreground">
                  +{remainingCount}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-sm">
                <div className="font-medium">
                  {remainingCount} more user{remainingCount > 1 ? 's' : ''}
                </div>
                <div className="max-w-48">
                  {users.slice(maxVisible).map(user => user.username).join(', ')}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
};