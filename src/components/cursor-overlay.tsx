"use client"

import React, { memo } from 'react';
import { UserCursor } from '@/lib/presence-service';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion, AnimatePresence } from 'framer-motion';

interface CursorOverlayProps {
  cursors: UserCursor[];
}

const CursorPointer = memo(({ cursor }: { cursor: UserCursor }) => {
  return (
    <motion.div
      key={cursor.userId}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.2 }}
      className="absolute pointer-events-none z-50"
      style={{
        left: cursor.x,
        top: cursor.y,
        color: cursor.color
      }}
    >
      {/* Cursor pointer */}
      <div className="relative">
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          className="drop-shadow-sm"
        >
          <path
            d="M2 2L8.5 17L10.5 10.5L17 8.5L2 2Z"
            fill={cursor.color}
            stroke="white"
            strokeWidth="1"
          />
        </svg>

        {/* User info tooltip - only show on hover or when cursor is active */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ delay: 0.5, duration: 0.2 }}
          className="absolute left-5 top-2 flex items-center gap-2 px-2 py-1 rounded-md shadow-lg text-xs whitespace-nowrap z-10"
          style={{
            backgroundColor: cursor.color,
            color: 'white'
          }}
        >
          {cursor.avatarUrl && (
            <Avatar className="w-4 h-4">
              <AvatarImage src={cursor.avatarUrl} />
              <AvatarFallback className="text-xs font-medium">
                {cursor.username[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
          <span className="font-medium">{cursor.username}</span>
        </motion.div>
      </div>
    </motion.div>
  );
});

CursorPointer.displayName = 'CursorPointer';

export const CursorOverlay = memo(({ cursors }: CursorOverlayProps) => {
  console.log('[CursorOverlay] Component rendering:', {
    timestamp: new Date().toISOString(),
    enabled: process.env.NEXT_PUBLIC_ENABLE_CURSOR_OVERLAY,
    cursorsLength: cursors?.length || 0,
    renderCount: Math.random()
  });

  if (process.env.NEXT_PUBLIC_ENABLE_CURSOR_OVERLAY !== 'true') return null;

  // Log AnimatePresence rendering in useEffect
  React.useEffect(() => {
    console.log('[CursorOverlay] AnimatePresence rendering:', {
      timestamp: new Date().toISOString(),
      cursorsLength: cursors.length
    })
  })

  return (
    <div className="fixed inset-0 pointer-events-none z-40">
      <AnimatePresence>
        {cursors.map((cursor) => (
          <CursorPointer key={cursor.userId} cursor={cursor} />
        ))}
      </AnimatePresence>
    </div>
  );
});
