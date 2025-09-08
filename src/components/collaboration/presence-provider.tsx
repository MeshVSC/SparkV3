"use client"

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { socketClient, UserPresence, SparkEditingSession, ConnectionStatus } from '@/lib/socket-client';

interface PresenceContextType {
  // Connection status
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  
  // Current user
  currentUser: UserPresence | null;
  
  // Room state
  onlineUsers: UserPresence[];
  activeSparks: SparkEditingSession[];
  
  // User cursors
  userCursors: Map<string, { userId: string; username: string; x: number; y: number; lastUpdate: string }>;
  
  // Actions
  joinWorkspace: (userData: { userId: string; username: string; avatar?: string; workspaceId: string }) => void;
  leaveWorkspace: (workspaceId: string) => void;
  updatePresence: (status: 'online' | 'idle' | 'away') => void;
  updateCursor: (x: number, y: number) => void;
  startEditingSpark: (sparkId: string) => void;
  endEditingSpark: (sparkId: string) => void;
  broadcastSparkChange: (data: {
    sparkId: string;
    content: string;
    changeType: 'title' | 'description' | 'content' | 'status' | 'position';
    position?: { x: number; y: number };
  }) => void;
}

const PresenceContext = createContext<PresenceContextType | null>(null);

interface PresenceProviderProps {
  children: ReactNode;
}

export const PresenceProvider: React.FC<PresenceProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [currentUser, setCurrentUser] = useState<UserPresence | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
  const [activeSparks, setActiveSparks] = useState<SparkEditingSession[]>([]);
  const [userCursors, setUserCursors] = useState(new Map<string, { userId: string; username: string; x: number; y: number; lastUpdate: string }>());

  useEffect(() => {
    // Initialize socket connection
    const initializeSocket = async () => {
      try {
        await socketClient.connect();
        setIsConnected(socketClient.isConnected());
        setConnectionStatus(socketClient.getConnectionStatus());
      } catch (error) {
        console.error('Failed to connect to socket:', error);
        setConnectionStatus('error');
      }
    };

    initializeSocket();

    // Set up socket event listeners
    socketClient.on('connected', (data) => {
      console.log('Socket connected:', data);
      setIsConnected(true);
      setConnectionStatus('connected');
    });

    socketClient.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
      setConnectionStatus('disconnected');
      setOnlineUsers([]);
      setActiveSparks([]);
      setUserCursors(new Map());
    });

    socketClient.on('user_joined', (data) => {
      console.log('User joined:', data.user);
      setOnlineUsers(prev => {
        const existing = prev.find(user => user.userId === data.user.userId);
        if (existing) {
          return prev.map(user => user.userId === data.user.userId ? data.user : user);
        }
        return [...prev, data.user];
      });
    });

    socketClient.on('user_left', (data) => {
      console.log('User left:', data.userId);
      setOnlineUsers(prev => prev.filter(user => user.userId !== data.userId));
      setUserCursors(prev => {
        const newMap = new Map(prev);
        newMap.delete(data.userId);
        return newMap;
      });
    });

    socketClient.on('presence_updated', (data) => {
      console.log('Presence updated:', data);
      setOnlineUsers(prev => prev.map(user => 
        user.userId === data.userId 
          ? { ...user, status: data.status, lastSeen: data.lastSeen }
          : user
      ));
      
      if (currentUser && currentUser.userId === data.userId) {
        setCurrentUser(prev => prev ? { ...prev, status: data.status, lastSeen: data.lastSeen } : null);
      }
    });

    socketClient.on('room_state', (data) => {
      console.log('Room state received:', data);
      setOnlineUsers(data.users);
      setActiveSparks(data.activeSparks);
    });

    socketClient.on('cursor_updated', (data) => {
      setUserCursors(prev => {
        const newMap = new Map(prev);
        newMap.set(data.userId, {
          userId: data.userId,
          username: data.username,
          x: data.cursor.x,
          y: data.cursor.y,
          lastUpdate: data.cursor.lastUpdate
        });
        return newMap;
      });
    });

    socketClient.on('spark_editing_started', (data) => {
      console.log('Spark editing started:', data);
      setActiveSparks(prev => {
        const existing = prev.find(session => 
          session.sparkId === data.sparkId && session.userId === data.userId
        );
        if (existing) return prev;
        return [...prev, {
          sparkId: data.sparkId,
          userId: data.userId,
          username: data.username,
          startedAt: data.startedAt
        }];
      });
    });

    socketClient.on('spark_editing_ended', (data) => {
      console.log('Spark editing ended:', data);
      setActiveSparks(prev => prev.filter(session => 
        !(session.sparkId === data.sparkId && session.userId === data.userId)
      ));
    });

    socketClient.on('spark_content_changed', (data) => {
      console.log('Spark content changed:', data);
      // This can be handled by the consuming components
      // Emit custom event for components to listen to
      const event = new CustomEvent('spark_content_changed', { detail: data });
      window.dispatchEvent(event);
    });

    // Cleanup on unmount
    return () => {
      socketClient.disconnect();
    };
  }, [currentUser]);

  const joinWorkspace = (userData: { userId: string; username: string; avatar?: string; workspaceId: string }) => {
    console.log('Joining workspace:', userData);
    setCurrentUser({
      ...userData,
      status: 'online',
      lastSeen: new Date().toISOString()
    });
    socketClient.joinWorkspace(userData);
  };

  const leaveWorkspace = (workspaceId: string) => {
    console.log('Leaving workspace:', workspaceId);
    socketClient.leaveWorkspace(workspaceId);
    setCurrentUser(null);
    setOnlineUsers([]);
    setActiveSparks([]);
    setUserCursors(new Map());
  };

  const updatePresence = (status: 'online' | 'idle' | 'away') => {
    console.log('Updating presence:', status);
    if (currentUser) {
      setCurrentUser(prev => prev ? { ...prev, status } : null);
    }
    socketClient.updatePresence(status);
  };

  const updateCursor = (x: number, y: number) => {
    socketClient.updateCursor(x, y);
  };

  const startEditingSpark = (sparkId: string) => {
    console.log('Starting to edit spark:', sparkId);
    socketClient.startEditingSpark(sparkId);
  };

  const endEditingSpark = (sparkId: string) => {
    console.log('Ending spark editing:', sparkId);
    socketClient.endEditingSpark(sparkId);
  };

  const broadcastSparkChange = (data: {
    sparkId: string;
    content: string;
    changeType: 'title' | 'description' | 'content' | 'status' | 'position';
    position?: { x: number; y: number };
  }) => {
    console.log('Broadcasting spark change:', data);
    socketClient.broadcastSparkChange(data);
  };

  const value: PresenceContextType = {
    isConnected,
    connectionStatus,
    currentUser,
    onlineUsers,
    activeSparks,
    userCursors,
    joinWorkspace,
    leaveWorkspace,
    updatePresence,
    updateCursor,
    startEditingSpark,
    endEditingSpark,
    broadcastSparkChange
  };

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
};

export const usePresence = (): PresenceContextType => {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error('usePresence must be used within a PresenceProvider');
  }
  return context;
};