"use client"

import React, { useEffect, useState } from 'react';
import { usePresence } from './presence-provider';

interface UserCursor {
  userId: string;
  username: string;
  x: number;
  y: number;
  lastUpdate: string;
  color: string;
}

interface UserCursorsProps {
  containerRef: React.RefObject<HTMLElement>;
  isVisible?: boolean;
}

export const UserCursors: React.FC<UserCursorsProps> = ({
  containerRef,
  isVisible = true
}) => {
  const { userCursors, currentUser } = usePresence();
  const [visibleCursors, setVisibleCursors] = useState<UserCursor[]>([]);

  // Color palette for user cursors
  const cursorColors = [
    '#ef4444', // red-500
    '#f97316', // orange-500
    '#eab308', // yellow-500
    '#22c55e', // green-500
    '#06b6d4', // cyan-500
    '#3b82f6', // blue-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
  ];

  const getUserColor = (userId: string): string => {
    // Generate consistent color based on user ID
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return cursorColors[Math.abs(hash) % cursorColors.length];
  };

  useEffect(() => {
    const cursors: UserCursor[] = [];
    const now = new Date().getTime();
    
    userCursors.forEach((cursor, userId) => {
      // Skip current user's cursor
      if (currentUser?.userId === userId) return;
      
      // Hide cursors that haven't been updated in the last 10 seconds
      const lastUpdate = new Date(cursor.lastUpdate).getTime();
      if (now - lastUpdate > 10000) return;
      
      cursors.push({
        ...cursor,
        color: getUserColor(userId)
      });
    });
    
    setVisibleCursors(cursors);
  }, [userCursors, currentUser]);

  if (!isVisible || visibleCursors.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {visibleCursors.map((cursor) => (
        <div
          key={cursor.userId}
          className="absolute transition-all duration-100 ease-out"
          style={{
            left: cursor.x,
            top: cursor.y,
            transform: 'translate(-2px, -2px)'
          }}
        >
          {/* Cursor pointer */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            className="drop-shadow-md"
          >
            <path
              d="M3 3L17 10L10 10.5L7 17L3 3Z"
              fill={cursor.color}
              stroke="white"
              strokeWidth="1"
            />
          </svg>
          
          {/* Username label */}
          <div
            className="ml-5 -mt-4 px-2 py-1 text-xs font-medium text-white rounded-md shadow-lg whitespace-nowrap"
            style={{ backgroundColor: cursor.color }}
          >
            {cursor.username}
          </div>
        </div>
      ))}
    </div>
  );
};