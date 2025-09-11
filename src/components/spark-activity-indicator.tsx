"use client"

import React, { memo } from 'react';
import { PresenceUser } from '@/lib/presence-service';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion, AnimatePresence } from 'framer-motion';

interface SparkActivityIndicatorProps {
  sparkId: string;
  users: PresenceUser[];
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const SparkActivityIndicator = memo(({ 
  sparkId,
  users, 
  className = "",
  size = 'sm'
}: SparkActivityIndicatorProps) => {
  const isActive = users.length > 0;
  const maxVisible = size === 'sm' ? 2 : size === 'md' ? 3 : 5;
  const visibleUsers = users.slice(0, maxVisible);
  const hiddenCount = Math.max(0, users.length - maxVisible);
  
  const sizeClasses = {
    sm: { avatar: 'w-4 h-4', border: 'border', ring: 'ring-1', text: 'text-xs' },
    md: { avatar: 'w-6 h-6', border: 'border-2', ring: 'ring-2', text: 'text-sm' },
    lg: { avatar: 'w-8 h-8', border: 'border-2', ring: 'ring-2', text: 'text-base' }
  };

  const classes = sizeClasses[size];

  if (!isActive) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className={`absolute -top-1 -right-1 flex items-center z-20 ${className}`}
    >
      {/* Activity pulse indicator */}
      <div className="relative mr-1">
        <motion.div
          className="w-2 h-2 bg-green-500 rounded-full shadow-sm"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [1, 0.6, 1]
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute inset-0 w-2 h-2 bg-green-400 rounded-full"
          animate={{
            scale: [1, 2, 1],
            opacity: [0.3, 0, 0.3]
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.3
          }}
        />
      </div>

      {/* User avatars */}
      <div className="flex -space-x-1">
        <AnimatePresence>
          {visibleUsers.map((user, index) => (
            <motion.div
              key={user.userId}
              initial={{ opacity: 0, scale: 0.5, x: -10 }}
              animate={{ 
                opacity: 1, 
                scale: 1, 
                x: 0,
                transition: { delay: index * 0.05 }
              }}
              exit={{ 
                opacity: 0, 
                scale: 0.5, 
                x: -10 
              }}
            >
              <Avatar 
                className={`${classes.avatar} ${classes.border} border-background ${classes.ring} ring-offset-1`}
                style={{ 
                  ringColor: user.color 
                }}
              >
                <AvatarImage src={user.avatarUrl} />
                <AvatarFallback 
                  className={`${classes.text} font-medium`}
                  style={{ 
                    backgroundColor: user.color + '20',
                    color: user.color 
                  }}
                >
                  {user.username[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {hiddenCount > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`flex items-center justify-center ${classes.avatar} bg-muted rounded-full ${classes.border} border-background ${classes.text} font-medium`}
          >
            +{hiddenCount}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
});

SparkActivityIndicator.displayName = 'SparkActivityIndicator';