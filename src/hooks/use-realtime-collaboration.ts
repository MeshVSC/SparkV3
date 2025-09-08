import { useEffect, useCallback, useRef } from 'react';
import { useRealtimeStore, realtimeService } from '@/lib/realtime-service';
import { UserPresence } from '@/lib/socket-client';

interface UseRealtimeCollaborationProps {
  workspaceId?: string;
  userId?: string;
  username?: string;
  avatar?: string;
  autoConnect?: boolean;
  onUserJoined?: (user: UserPresence) => void;
  onUserLeft?: (userId: string, username: string) => void;
  onPresenceUpdated?: (userId: string, status: 'online' | 'idle' | 'away', lastSeen: string) => void;
  onSparkEditingStarted?: (sparkId: string, userId: string, username: string) => void;
  onSparkEditingEnded?: (sparkId: string, userId: string, username: string) => void;
  onSparkContentChanged?: (data: {
    sparkId: string;
    content: string;
    changeType: 'title' | 'description' | 'content' | 'status' | 'position';
    position?: { x: number; y: number };
    userId: string;
    username: string;
  }) => void;
}

export const useRealtimeCollaboration = ({
  workspaceId,
  userId,
  username,
  avatar,
  autoConnect = true,
  onUserJoined,
  onUserLeft,
  onPresenceUpdated,
  onSparkEditingStarted,
  onSparkEditingEnded,
  onSparkContentChanged
}: UseRealtimeCollaborationProps = {}) => {
  const {
    connectionStatus,
    isConnected,
    connectedUsers,
    currentUser,
    activeSparkSessions,
    editingSparks,
    connect,
    disconnect,
    joinWorkspace,
    leaveWorkspace,
    updatePresence,
    startEditingSpark,
    endEditingSpark,
    broadcastSparkChange
  } = useRealtimeStore();

  const connectedRef = useRef(false);

  // Set up event callbacks
  useEffect(() => {
    realtimeService.setCallbacks({
      onUserJoined,
      onUserLeft,
      onPresenceUpdated,
      onSparkEditingStarted,
      onSparkEditingEnded,
      onSparkContentChanged
    });
  }, [onUserJoined, onUserLeft, onPresenceUpdated, onSparkEditingStarted, onSparkEditingEnded, onSparkContentChanged]);

  // Auto-connect when component mounts
  useEffect(() => {
    if (autoConnect && !connectedRef.current && !isConnected) {
      connectedRef.current = true;
      connect().catch(console.error);
    }

    return () => {
      if (connectedRef.current && workspaceId) {
        leaveWorkspace(workspaceId);
      }
    };
  }, [autoConnect, isConnected, connect, leaveWorkspace, workspaceId]);

  // Auto-join workspace when all required data is available
  useEffect(() => {
    if (isConnected && workspaceId && userId && username && !currentUser) {
      joinWorkspace({ userId, username, avatar, workspaceId });
    }
  }, [isConnected, workspaceId, userId, username, avatar, currentUser, joinWorkspace]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (workspaceId) {
        leaveWorkspace(workspaceId);
      }
    };
  }, [workspaceId, leaveWorkspace]);

  // Spark editing management
  const handleStartEditingSpark = useCallback((sparkId: string) => {
    if (isConnected) {
      startEditingSpark(sparkId);
    }
  }, [isConnected, startEditingSpark]);

  const handleEndEditingSpark = useCallback((sparkId: string) => {
    if (isConnected) {
      endEditingSpark(sparkId);
    }
  }, [isConnected, endEditingSpark]);

  const handleBroadcastSparkChange = useCallback((data: {
    sparkId: string;
    content: string;
    changeType: 'title' | 'description' | 'content' | 'status' | 'position';
    position?: { x: number; y: number };
  }) => {
    if (isConnected) {
      broadcastSparkChange(data);
    }
  }, [isConnected, broadcastSparkChange]);

  // Helper functions
  const isSparkBeingEdited = useCallback((sparkId: string) => {
    return editingSparks.has(sparkId);
  }, [editingSparks]);

  const getSparkEditors = useCallback((sparkId: string) => {
    return activeSparkSessions.filter(session => session.sparkId === sparkId);
  }, [activeSparkSessions]);

  const isUserOnline = useCallback((targetUserId: string) => {
    return connectedUsers.some(user => user.userId === targetUserId && user.status === 'online');
  }, [connectedUsers]);

  const getUserPresence = useCallback((targetUserId: string) => {
    return connectedUsers.find(user => user.userId === targetUserId);
  }, [connectedUsers]);

  return {
    // Connection state
    connectionStatus,
    isConnected,
    
    // User presence
    connectedUsers,
    currentUser,
    
    // Spark collaboration
    activeSparkSessions,
    editingSparks: Array.from(editingSparks),
    
    // Actions
    connect,
    disconnect,
    joinWorkspace,
    leaveWorkspace,
    updatePresence,
    startEditingSpark: handleStartEditingSpark,
    endEditingSpark: handleEndEditingSpark,
    broadcastSparkChange: handleBroadcastSparkChange,
    
    // Helper functions
    isSparkBeingEdited,
    getSparkEditors,
    isUserOnline,
    getUserPresence
  };
};