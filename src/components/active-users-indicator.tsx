"use client"

import React, { memo } from 'react';
import { PresenceUser } from '@/lib/presence-service';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Eye } from 'lucide-react';

interface ActiveUsersIndicatorProps {
  users: PresenceUser[];
  className?: string;
  showUsernames?: boolean;
  maxVisible?: number;
}

export const ActiveUsersIndicator = memo(({ 
  users, 
  className = "",
  showUsernames = false,
  maxVisible = 5
}: ActiveUsersIndicatorProps) => {
  const visibleUsers = users.slice(0, maxVisible);
  const hiddenCount = Math.max(0, users.length - maxVisible);

  if (users.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className={`flex items-center gap-2 ${className}`}>
        <motion.div 
          className="flex items-center gap-1"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <Eye className="w-4 h-4 text-muted-foreground" />
          <Badge variant="secondary" className="text-xs">
            {users.length}
          </Badge>
        </motion.div>

        <div className="flex -space-x-2">
          <AnimatePresence>
            {visibleUsers.map((user, index) => (
              <Tooltip key={user.userId}>
                <TooltipTrigger asChild>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5, x: -20 }}
                    animate={{ 
                      opacity: 1, 
                      scale: 1, 
                      x: 0,
                      transition: { delay: index * 0.1 }
                    }}
                    exit={{ 
                      opacity: 0, 
                      scale: 0.5, 
                      x: -20 
                    }}
                    className="relative"
                  >
                    <Avatar 
                      className="w-8 h-8 border-2 border-background ring-2 ring-offset-2"
                      style={{ 
                        ringColor: user.color,
                        borderColor: user.color 
                      }}
                    >
                      <AvatarImage src={user.avatarUrl} />
                      <AvatarFallback 
                        className="text-xs font-medium"
                        style={{ 
                          backgroundColor: user.color + '20',
                          color: user.color 
                        }}
                      >
                        {user.username[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    {/* Online indicator */}
                    <div 
                      className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-background"
                      style={{ backgroundColor: user.color }}
                    />
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: user.color }}
                    />
                    <span>{user.username}</span>
                    <span className="text-xs text-muted-foreground">
                      joined {new Date(user.joinedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </AnimatePresence>
          
          {hiddenCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center justify-center w-8 h-8 bg-muted rounded-full border-2 border-background text-xs font-medium"
                >
                  +{hiddenCount}
                </motion.div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <span>{hiddenCount} more user{hiddenCount !== 1 ? 's' : ''}</span>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {showUsernames && (
          <div className="flex flex-wrap gap-1">
            {visibleUsers.map((user) => (
              <Badge 
                key={user.userId} 
                variant="outline" 
                className="text-xs"
                style={{ 
                  borderColor: user.color,
                  color: user.color
                }}
              >
                {user.username}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
});

ActiveUsersIndicator.displayName = 'ActiveUsersIndicator';