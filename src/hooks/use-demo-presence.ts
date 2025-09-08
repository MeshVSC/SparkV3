"use client"

import { useEffect } from 'react';
import { usePresence } from '@/components/collaboration/presence-provider';

/**
 * Demo hook to automatically join workspace with a mock user
 * This is for development/testing purposes only
 */
export const useDemoPresence = () => {
  const { joinWorkspace, isConnected, currentUser } = usePresence();

  useEffect(() => {
    if (isConnected && !currentUser) {
      // Generate a random demo user
      const demoUsers = [
        { name: 'Alice Johnson', avatar: 'https://avatar.vercel.sh/alice' },
        { name: 'Bob Smith', avatar: 'https://avatar.vercel.sh/bob' },
        { name: 'Carol Williams', avatar: 'https://avatar.vercel.sh/carol' },
        { name: 'David Brown', avatar: 'https://avatar.vercel.sh/david' },
        { name: 'Emma Wilson', avatar: 'https://avatar.vercel.sh/emma' }
      ];
      
      const randomUser = demoUsers[Math.floor(Math.random() * demoUsers.length)];
      const userId = `demo_${Math.random().toString(36).substr(2, 9)}`;
      
      joinWorkspace({
        userId,
        username: randomUser.name,
        avatar: randomUser.avatar,
        workspaceId: 'demo-workspace-1' // Default demo workspace
      });
    }
  }, [isConnected, currentUser, joinWorkspace]);

  return { isConnected, currentUser };
};