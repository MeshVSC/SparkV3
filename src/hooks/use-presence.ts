import { useState, useEffect, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { PresenceUser, UserCursor } from '@/lib/presence-service';
import { getSocket } from '@/lib/socket-client';

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

  const cursorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Get shared socket instance
  const socket = getSocket();

  // Manage socket connection
  useEffect(() => {
    // Check if presence is enabled via environment variable
    const presenceEnabled = process.env.NEXT_PUBLIC_ENABLE_PRESENCE === 'true';
    if (!enabled || !sparkId || !userId || !socket || !presenceEnabled) return;

    // Connect if not connected (with error handling)
    if (!socket.connected) {
      try {
        socket.connect();
      } catch (error) {
        console.warn('Socket connection failed:', error);
        if (mountedRef.current) {
          setState(prev => ({ ...prev, error: 'Connection failed' }));
        }
        return;
      }
    }

    // Define event handlers
    const onConnect = () => {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, isConnected: true, error: null }));
        socket.emit('join_presence', { sparkId, userId, username, avatarUrl });
      }
    };

    const onDisconnect = () => {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, isConnected: false }));
      }
    };

    const onPresenceState = (data: { users: PresenceUser[]; cursors: UserCursor[] }) => {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, users: data.users, cursors: data.cursors }));
      }
    };

    const onUserJoined = (user: PresenceUser) => {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          users: [...prev.users.filter(u => u.userId !== user.userId), user]
        }));
      }
    };

    const onUserLeft = (data: { userId: string }) => {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          users: prev.users.filter(u => u.userId !== data.userId),
          cursors: prev.cursors.filter(c => c.userId !== data.userId)
        }));
      }
    };

    const onCursorMoved = (cursor: UserCursor) => {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          cursors: [...prev.cursors.filter(c => c.userId !== cursor.userId), cursor]
        }));
      }
    };

    const onCursorDisappeared = (data: { userId: string }) => {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          cursors: prev.cursors.filter(c => c.userId !== data.userId)
        }));
      }
    };

    const onPresenceError = (data: { message: string }) => {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, error: data.message }));
      }
    };

    // Register event listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('presence_state', onPresenceState);
    socket.on('user_joined', onUserJoined);
    socket.on('user_left', onUserLeft);
    socket.on('cursor_moved', onCursorMoved);
    socket.on('cursor_disappeared', onCursorDisappeared);
    socket.on('cursor_hidden', onCursorDisappeared);
    socket.on('presence_error', onPresenceError);

    // Join presence if already connected
    if (socket.connected) {
      socket.emit('join_presence', { sparkId, userId, username, avatarUrl });
    }

    return () => {
      // Clean up event listeners
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('presence_state', onPresenceState);
      socket.off('user_joined', onUserJoined);
      socket.off('user_left', onUserLeft);
      socket.off('cursor_moved', onCursorMoved);
      socket.off('cursor_disappeared', onCursorDisappeared);
      socket.off('cursor_hidden', onCursorDisappeared);
      socket.off('presence_error', onPresenceError);

      // Leave presence room
      if (socket.connected) {
        socket.emit('leave_presence', { sparkId });
      }
      
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
        cursorTimeoutRef.current = null;
      }
    };
  }, [sparkId, userId, username, avatarUrl, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Update cursor position
  const updateCursor = useCallback((x: number, y: number) => {
    if (!socket || !socket.connected) return;

    // Don't send cursor updates for off-screen positions
    if (x < -999 || y < -999) {
      socket.emit('cursor_hide', { sparkId });
      return;
    }

    socket.emit('cursor_update', {
      sparkId,
      x,
      y
    });

    // Clear previous timeout and set new one to hide cursor after inactivity
    if (cursorTimeoutRef.current) {
      clearTimeout(cursorTimeoutRef.current);
    }

    cursorTimeoutRef.current = setTimeout(() => {
      if (socket && socket.connected) {
        socket.emit('cursor_hide', { sparkId });
      }
    }, 5000); // Hide cursor after 5 seconds of inactivity
  }, [sparkId]);

  // Leave presence room
  const leavePresence = useCallback(() => {
    if (!socket || !socket.connected) return;

    socket.emit('leave_presence', { sparkId });
  }, [sparkId, socket]);

  return {
    users: state.users.filter(u => u.userId !== userId), // Exclude current user
    cursors: state.cursors.filter(c => c.userId !== userId), // Exclude current user's cursor
    isConnected: state.isConnected,
    error: state.error,
    updateCursor,
    leavePresence
  };
}