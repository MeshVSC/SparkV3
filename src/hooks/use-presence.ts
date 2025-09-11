import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { PresenceUser, UserCursor } from '@/lib/presence-service';

interface UsePresenceOptions {
  sparkId: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  enabled?: boolean;
}

interface PresenceState {
  users: PresenceUser[];
  cursors: UserCursor[];
  isConnected: boolean;
  error: string | null;
}

export function usePresence(options: UsePresenceOptions) {
  const { sparkId, userId, username, avatarUrl, enabled = true } = options;
  
  const [state, setState] = useState<PresenceState>({
    users: [],
    cursors: [],
    isConnected: false,
    error: null
  });

  const socketRef = useRef<Socket | null>(null);
  const cursorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize socket connection
  useEffect(() => {
    if (!enabled || !sparkId || !userId) return;

    const socket = io(process.env.NODE_ENV === 'production' ? 
      `${window.location.protocol}//${window.location.host}` : 
      'http://localhost:3000', {
      path: '/api/socketio',
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setState(prev => ({ ...prev, isConnected: true, error: null }));
      
      // Join presence room
      socket.emit('join_presence', {
        sparkId,
        userId,
        username,
        avatarUrl
      });
    });

    socket.on('disconnect', () => {
      setState(prev => ({ ...prev, isConnected: false }));
    });

    socket.on('presence_state', (data: { users: PresenceUser[]; cursors: UserCursor[] }) => {
      setState(prev => ({
        ...prev,
        users: data.users,
        cursors: data.cursors
      }));
    });

    socket.on('user_joined', (user: PresenceUser) => {
      setState(prev => ({
        ...prev,
        users: [...prev.users.filter(u => u.userId !== user.userId), user]
      }));
    });

    socket.on('user_left', (data: { userId: string }) => {
      setState(prev => ({
        ...prev,
        users: prev.users.filter(u => u.userId !== data.userId),
        cursors: prev.cursors.filter(c => c.userId !== data.userId)
      }));
    });

    socket.on('cursor_moved', (cursor: UserCursor) => {
      setState(prev => ({
        ...prev,
        cursors: [
          ...prev.cursors.filter(c => c.userId !== cursor.userId),
          cursor
        ]
      }));
    });

    socket.on('cursor_disappeared', (data: { userId: string }) => {
      setState(prev => ({
        ...prev,
        cursors: prev.cursors.filter(c => c.userId !== data.userId)
      }));
    });

    socket.on('cursor_hidden', (data: { userId: string }) => {
      setState(prev => ({
        ...prev,
        cursors: prev.cursors.filter(c => c.userId !== data.userId)
      }));
    });

    socket.on('presence_error', (data: { message: string }) => {
      setState(prev => ({ ...prev, error: data.message }));
    });

    return () => {
      socket.emit('leave_presence', { sparkId });
      socket.disconnect();
      socketRef.current = null;
      
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
    };
  }, [sparkId, userId, username, avatarUrl, enabled]);

  // Update cursor position
  const updateCursor = useCallback((x: number, y: number) => {
    if (!socketRef.current || !state.isConnected) return;

    // Don't send cursor updates for off-screen positions
    if (x < -999 || y < -999) {
      socketRef.current.emit('cursor_hide', { sparkId });
      return;
    }

    socketRef.current.emit('cursor_update', {
      sparkId,
      x,
      y
    });

    // Clear previous timeout and set new one to hide cursor after inactivity
    if (cursorTimeoutRef.current) {
      clearTimeout(cursorTimeoutRef.current);
    }

    cursorTimeoutRef.current = setTimeout(() => {
      if (socketRef.current) {
        socketRef.current.emit('cursor_hide', { sparkId });
      }
    }, 5000); // Hide cursor after 5 seconds of inactivity
  }, [sparkId, userId, state.isConnected]);

  // Leave presence room
  const leavePresence = useCallback(() => {
    if (!socketRef.current) return;

    socketRef.current.emit('leave_presence', { sparkId });
  }, [sparkId]);

  return {
    users: state.users.filter(u => u.userId !== userId), // Exclude current user
    cursors: state.cursors.filter(c => c.userId !== userId), // Exclude current user's cursor
    isConnected: state.isConnected,
    error: state.error,
    updateCursor,
    leavePresence
  };
}