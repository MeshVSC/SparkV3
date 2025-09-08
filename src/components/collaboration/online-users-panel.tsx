"use client"

import React from 'react';
import { usePresence } from './presence-provider';
import { Avatar, AvatarImage, AvatarFallback, PresenceIndicator } from '@/components/ui/avatar';
import { QuickTooltip } from '@/components/ui/tooltip';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Users, Wifi, WifiOff, AlertCircle } from 'lucide-react';

interface OnlineUsersPanelProps {
  className?: string;
  showTitle?: boolean;
  maxVisible?: number;
}

export const OnlineUsersPanel: React.FC<OnlineUsersPanelProps> = ({
  className = "",
  showTitle = true,
  maxVisible = 8
}) => {
  const { onlineUsers, activeSparks, connectionStatus, currentUser } = usePresence();

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'disconnected':
        return <WifiOff className="h-4 w-4 text-red-500" />;
      case 'reconnecting':
        return <AlertCircle className="h-4 w-4 text-yellow-500 animate-pulse" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-400" />;
    }
  };

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getUserEditingSpark = (userId: string) => {
    return activeSparks.find(session => session.userId === userId);
  };

  const visibleUsers = onlineUsers.slice(0, maxVisible);
  const hiddenCount = Math.max(0, onlineUsers.length - maxVisible);

  return (
    <Card className={className}>
      {showTitle && (
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Online ({onlineUsers.length})
            {getStatusIcon()}
          </CardTitle>
        </CardHeader>
      )}
      
      <CardContent className={showTitle ? "pt-0" : ""}>
        {connectionStatus === 'disconnected' && (
          <div className="text-center py-4 text-muted-foreground">
            <WifiOff className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Not connected</p>
          </div>
        )}
        
        {connectionStatus === 'connected' && onlineUsers.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No one else online</p>
          </div>
        )}

        {onlineUsers.length > 0 && (
          <div className="space-y-3">
            {visibleUsers.map((user) => {
              const editingSpark = getUserEditingSpark(user.userId);
              const isCurrentUser = currentUser?.userId === user.userId;
              
              return (
                <div key={user.userId} className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar} alt={user.username} />
                      <AvatarFallback className="text-xs">
                        {getUserInitials(user.username)}
                      </AvatarFallback>
                    </Avatar>
                    <PresenceIndicator 
                      status={user.status} 
                      size="sm" 
                      showPulse={user.status === 'online'}
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <QuickTooltip content={`${user.status} - last seen ${getTimeAgo(user.lastSeen)}`}>
                        <p className="text-sm font-medium truncate">
                          {user.username}
                          {isCurrentUser && (
                            <span className="text-xs text-muted-foreground ml-1">(you)</span>
                          )}
                        </p>
                      </QuickTooltip>
                      
                      {editingSpark && (
                        <QuickTooltip content={`Editing spark since ${getTimeAgo(editingSpark.startedAt)}`}>
                          <Badge variant="secondary" className="text-xs px-1 py-0">
                            editing
                          </Badge>
                        </QuickTooltip>
                      )}
                    </div>
                    
                    <p className="text-xs text-muted-foreground">
                      {user.status === 'online' ? 'Active now' : getTimeAgo(user.lastSeen)}
                    </p>
                  </div>
                </div>
              );
            })}
            
            {hiddenCount > 0 && (
              <>
                <Separator />
                <div className="text-center">
                  <Badge variant="outline" className="text-xs">
                    +{hiddenCount} more
                  </Badge>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};