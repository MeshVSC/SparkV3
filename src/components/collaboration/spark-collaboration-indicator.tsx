"use client"

import React from 'react';
import { usePresence } from './presence-provider';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { QuickTooltip } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Edit, Users } from 'lucide-react';

interface SparkCollaborationIndicatorProps {
  sparkId: string;
  className?: string;
}

export const SparkCollaborationIndicator: React.FC<SparkCollaborationIndicatorProps> = ({
  sparkId,
  className = ""
}) => {
  const { activeSparks, onlineUsers } = usePresence();

  // Find all users currently editing this spark
  const editingSessions = activeSparks.filter(session => session.sparkId === sparkId);
  const editingUsers = editingSessions.map(session => {
    return onlineUsers.find(user => user.userId === session.userId);
  }).filter(Boolean);

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

  if (editingSessions.length === 0) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Editing indicator */}
      <div className="flex items-center gap-1">
        <Edit className="h-3 w-3 text-blue-500 animate-pulse" />
        <Badge variant="outline" className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 border-blue-200">
          <Users className="h-2.5 w-2.5 mr-1" />
          {editingSessions.length}
        </Badge>
      </div>
      
      {/* User avatars */}
      <div className="flex -space-x-1">
        {editingUsers.slice(0, 3).map((user, index) => {
          if (!user) return null;
          
          const session = editingSessions.find(s => s.userId === user.userId);
          const tooltipContent = `${user.username} is editing (started ${getTimeAgo(session?.startedAt || '')})`;
          
          return (
            <QuickTooltip key={user.userId} content={tooltipContent}>
              <Avatar className="h-6 w-6 border-2 border-background">
                <AvatarImage src={user.avatar} alt={user.username} />
                <AvatarFallback className="text-xs font-medium">
                  {getUserInitials(user.username)}
                </AvatarFallback>
              </Avatar>
            </QuickTooltip>
          );
        })}
        
        {editingUsers.length > 3 && (
          <QuickTooltip content={`${editingUsers.length - 3} more users editing`}>
            <div className="h-6 w-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-medium">
              +{editingUsers.length - 3}
            </div>
          </QuickTooltip>
        )}
      </div>
    </div>
  );
};