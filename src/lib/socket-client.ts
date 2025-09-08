import { io, Socket } from 'socket.io-client';

interface CollaborationEvent {
  type: 'user_joined' | 'user_left' | 'spark_updated' | 'presence_changed' | 'notification';
  data: any;
  timestamp: string;
}

interface NotificationEvent {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  timestamp: string;
  userId: string;
  data?: Record<string, any>;
}

interface UserSession {
  userId: string;
  username: string;
  email: string;
  sessionId: string;
  timestamp: string;
}

export interface SocketEvents {
  // Connection events
  connected: (data: { message: string; socketId: string; timestamp: string }) => void;
  disconnect: () => void;
  connect_error: (error: Error) => void;
  reconnect: (attemptNumber: number) => void;
  reconnect_error: (error: Error) => void;
  reconnect_failed: () => void;
  connection_state_changed: (data: { connected: boolean; reason?: string }) => void;

  // Authentication events
  authenticated: (data: UserSession) => void;
  auth_error: (error: { message: string }) => void;

  // User presence events
  user_joined: (data: { user: UserPresence; timestamp: string }) => void;
  user_left: (data: { userId: string; username: string; timestamp: string }) => void;
  presence_updated: (data: { userId: string; status: 'online' | 'idle' | 'away'; lastSeen: string; timestamp: string }) => void;
  room_state: (data: { users: UserPresence[]; activeSparks: SparkEditingSession[]; timestamp: string }) => void;

  // Cursor events
  cursor_updated: (data: { userId: string; username: string; cursor: { x: number; y: number; lastUpdate: string }; timestamp: string }) => void;

  // Spark collaboration events
  spark_editing_started: (data: { sparkId: string; userId: string; username: string; startedAt: string; timestamp: string }) => void;
  spark_editing_ended: (data: { sparkId: string; userId: string; username: string; timestamp: string }) => void;
  spark_content_changed: (data: {
    sparkId: string;
    content: string;
    changeType: 'title' | 'description' | 'content' | 'status' | 'position';
    position?: { x: number; y: number };
    userId: string;
    username: string;
    timestamp: string;
  }) => void;

  // Enhanced notification events
  notification_received: (notification: NotificationEvent) => void;
  pending_notifications: (notifications: NotificationEvent[]) => void;
  heartbeat_ack: (data: { timestamp: string }) => void;

  // Workspace events
  workspace_change: (data: { type: string; workspaceId: string; data: any; timestamp: string }) => void;
  workspace_invitation: (data: any) => void;
  role_updated: (data: any) => void;
  workspace_removed: (data: any) => void;

  // Legacy events
  message: (data: { text: string; senderId: string; timestamp: string }) => void;
}

export interface UserPresence {
  userId: string;
  username: string;
  avatar?: string;
  workspaceId: string;
  status: 'online' | 'idle' | 'away';
  lastSeen: string;
  cursor?: {
    x: number;
    y: number;
    lastUpdate: string;
  };
}

export interface SparkEditingSession {
  sparkId: string;
  userId: string;
  username: string;
  startedAt: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

export class SocketClient {
  private socket: Socket | null = null;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private isAuthenticated = false;
  private userSession: UserSession | null = null;
  private eventListeners: Partial<SocketEvents> = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private currentUser: UserPresence | null = null;
  private idleTimer: NodeJS.Timeout | null = null;
  private awayTimer: NodeJS.Timeout | null = null;
  private cursorUpdateTimer: NodeJS.Timeout | null = null;
  private lastCursorUpdate: { x: number; y: number } | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Only setup activity tracking on client side
    if (typeof window !== 'undefined') {
      this.setupActivityTracking();
    }
  }

  async connect(url = '/api/socketio', token?: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (this.socket?.connected && this.isAuthenticated) {
        resolve();
        return;
      }

      try {
        // Get authentication token from NextAuth session if not provided
        if (!token) {
          // For now, we'll require token to be passed in
          // In a real implementation, you would get this from your auth provider
          console.error('No authentication token provided');
          reject(new Error('No authentication token provided'));
          return;
        }

        this.connectionStatus = 'connecting';
        this.notifyStatusChange();

        this.socket = io(url, {
          transports: ['websocket', 'polling'],
          timeout: 20000,
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: this.reconnectDelay,
          forceNew: true,
          auth: {
            token: token
          },
          query: {
            token: token // Fallback for servers that check query params
          }
        });

        this.setupSocketEventHandlers();

        this.socket.on('connect', () => {
          console.log('Socket connected:', this.socket?.id);
          this.connectionStatus = 'connected';
          this.reconnectAttempts = 0;
          this.notifyStatusChange();
          this.startHeartbeat();
        });

        this.socket.on('authenticated', (data: UserSession) => {
          console.log('Socket authenticated for user:', data.username);
          this.isAuthenticated = true;
          this.userSession = data;
          this.startPresenceTracking();
          this.eventListeners.authenticated?.(data);
          resolve();
        });

        this.socket.on('auth_error', (error: { message: string }) => {
          console.error('Socket authentication error:', error.message);
          this.isAuthenticated = false;
          this.eventListeners.auth_error?.(error);
          reject(new Error(error.message));
        });

        this.socket.on('connect_error', (error) => {
          console.error('Socket connection error:', error);
          this.connectionStatus = 'error';
          this.notifyStatusChange();
          this.eventListeners.connect_error?.(error);
          reject(error);
        });

      } catch (error) {
        console.error('Failed to connect socket:', error);
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connectionStatus = 'disconnected';
    this.isAuthenticated = false;
    this.userSession = null;
    this.currentUser = null;
    this.clearPresenceTimers();
    this.clearCursorTimer();
    this.notifyStatusChange();
  }

  // Connection status
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  isConnected(): boolean {
    return this.socket?.connected && this.isAuthenticated || false;
  }

  getSession(): UserSession | null {
    return this.userSession;
  }

  // Event listeners
  on<K extends keyof SocketEvents>(event: K, listener: SocketEvents[K]): void {
    this.eventListeners[event] = listener;
  }

  off<K extends keyof SocketEvents>(event: K): void {
    delete this.eventListeners[event];
  }

  // Enhanced notification methods
  sendNotificationToUser(
    targetUserId: string,
    type: string,
    title: string,
    message: string,
    priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium',
    data?: Record<string, any>
  ): boolean {
    if (!this.isAuthenticated || !this.socket?.connected) {
      console.warn('Cannot send notification: not authenticated or connected');
      return false;
    }

    this.socket.emit('send_notification', {
      targetUserId,
      type,
      title,
      message,
      priority,
      data
    });
    return true;
  }

  sendNotificationToWorkspace(
    workspaceId: string,
    type: string,
    title: string,
    message: string,
    priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium',
    data?: Record<string, any>
  ): boolean {
    if (!this.isAuthenticated || !this.socket?.connected) {
      console.warn('Cannot send notification: not authenticated or connected');
      return false;
    }

    this.socket.emit('notification_request', {
      workspaceId,
      type,
      title,
      message,
      priority,
      data
    });
    return true;
  }

  acknowledgeNotification(notificationId: string): void {
    if (!this.userSession || !this.socket?.connected) return;
    
    this.socket.emit('acknowledge_notification', { 
      notificationId,
      userId: this.userSession.userId 
    });
  }

  // User presence and status methods
  updateUserStatus(status: 'online' | 'away' | 'busy' | 'offline'): boolean {
    if (!this.isAuthenticated || !this.socket?.connected) return false;
    
    this.socket.emit('user_status_change', { status });
    return true;
  }

  getUserPresence(): Promise<{ users: any[] }> {
    return new Promise((resolve, reject) => {
      if (!this.isAuthenticated || !this.socket?.connected) {
        reject(new Error('Not authenticated or connected'));
        return;
      }

      this.socket.emit('get_user_presence', (response: { users: any[] }) => {
        resolve(response);
      });

      // Timeout after 5 seconds
      setTimeout(() => reject(new Error('Timeout')), 5000);
    });
  }

  // User presence methods (enhanced with authentication checks)
  joinWorkspace(userData: { userId: string; username: string; avatar?: string; workspaceId: string }): boolean {
    if (!this.socket?.connected || !this.isAuthenticated) {
      console.warn('Socket not connected or not authenticated, cannot join workspace');
      return false;
    }

    this.currentUser = {
      ...userData,
      status: 'online',
      lastSeen: new Date().toISOString()
    };

    this.socket.emit('user_join', userData);
    return true;
  }

  leaveWorkspace(workspaceId: string): boolean {
    if (!this.socket?.connected || !this.isAuthenticated) return false;
    
    this.socket.emit('user_leave', { workspaceId });
    this.currentUser = null;
    this.clearCursorTimer();
    return true;
  }

  updatePresence(status: 'online' | 'idle' | 'away'): boolean {
    if (!this.socket?.connected || !this.currentUser || !this.isAuthenticated) return false;
    
    this.currentUser.status = status;
    this.socket.emit('presence_update', { status });
    return true;
  }

  // Cursor tracking methods
  updateCursor(x: number, y: number): void {
    if (!this.socket?.connected) return;
    
    this.lastCursorUpdate = { x, y };
    
    // Debounce cursor updates to avoid flooding the server
    if (this.cursorUpdateTimer) {
      clearTimeout(this.cursorUpdateTimer);
    }
    
    this.cursorUpdateTimer = setTimeout(() => {
      if (this.lastCursorUpdate && this.socket?.connected) {
        this.socket.emit('cursor_update', this.lastCursorUpdate);
      }
    }, 50); // 20fps update rate
  }

  private clearCursorTimer(): void {
    if (this.cursorUpdateTimer) {
      clearTimeout(this.cursorUpdateTimer);
      this.cursorUpdateTimer = null;
    }
  }

  // Spark collaboration methods (enhanced with authentication checks)
  startEditingSpark(sparkId: string): boolean {
    if (!this.socket?.connected || !this.isAuthenticated) return false;
    this.socket.emit('spark_editing_start', { sparkId });
    return true;
  }

  endEditingSpark(sparkId: string): boolean {
    if (!this.socket?.connected || !this.isAuthenticated) return false;
    this.socket.emit('spark_editing_end', { sparkId });
    return true;
  }

  broadcastSparkChange(data: {
    sparkId: string;
    content: string;
    changeType: 'title' | 'description' | 'content' | 'status' | 'position';
    position?: { x: number; y: number };
  }): boolean {
    if (!this.socket?.connected || !this.isAuthenticated) return false;
    this.socket.emit('spark_content_change', data);
    return true;
  }

  // Legacy notification method (for backwards compatibility)
  sendNotification(notification: {
    text: string;
    type?: string;
    priority?: 'low' | 'medium' | 'high';
    data?: Record<string, any>;
    targetUserId?: string;
  }): void {
    if (!this.socket?.connected) return;
    this.socket.emit('notification', notification);
  }

  // Legacy method
  sendMessage(text: string, senderId: string): boolean {
    if (!this.socket?.connected || !this.isAuthenticated) return false;
    this.socket.emit('message', { text, senderId });
    return true;
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) return;
    
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected && this.isAuthenticated) {
        this.socket.emit('heartbeat');
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private setupSocketEventHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.connectionStatus = 'disconnected';
      this.isAuthenticated = false;
      this.clearPresenceTimers();
      this.clearCursorTimer();
      this.stopHeartbeat();
      this.notifyStatusChange();
      this.eventListeners.disconnect?.();

      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't reconnect automatically
        return;
      }

      // Auto-reconnect for client-side disconnects
      this.attemptReconnect();
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
      this.connectionStatus = 'connected';
      this.reconnectAttempts = 0;
      this.notifyStatusChange();
      this.startHeartbeat();
      
      // Note: Authentication will be handled automatically by the middleware
      
      this.eventListeners.reconnect?.(attemptNumber);
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('Socket reconnection error:', error);
      this.eventListeners.reconnect_error?.(error);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('Socket reconnection failed');
      this.connectionStatus = 'error';
      this.notifyStatusChange();
      this.eventListeners.reconnect_failed?.();
    });

    // Enhanced notification events
    this.socket.on('notification_received', (notification: NotificationEvent) => {
      console.log('Notification received:', notification);
      this.eventListeners.notification_received?.(notification);
      
      // Auto-acknowledge low priority notifications
      if (notification.priority === 'low') {
        setTimeout(() => {
          this.acknowledgeNotification(notification.id);
        }, 1000);
      }
    });

    this.socket.on('pending_notifications', (notifications: NotificationEvent[]) => {
      console.log('Received pending notifications:', notifications.length);
      this.eventListeners.pending_notifications?.(notifications);
      notifications.forEach(notification => {
        this.eventListeners.notification_received?.(notification);
      });
    });

    // Heartbeat for connection health
    this.socket.on('heartbeat_ack', (data) => {
      this.eventListeners.heartbeat_ack?.(data);
    });

    // Register all other possible events
    this.socket.on('connected', (data) => this.eventListeners.connected?.(data));
    this.socket.on('user_joined', (data) => this.eventListeners.user_joined?.(data));
    this.socket.on('user_left', (data) => this.eventListeners.user_left?.(data));
    this.socket.on('presence_updated', (data) => this.eventListeners.presence_updated?.(data));
    this.socket.on('room_state', (data) => this.eventListeners.room_state?.(data));
    this.socket.on('cursor_updated', (data) => this.eventListeners.cursor_updated?.(data));
    this.socket.on('spark_editing_started', (data) => this.eventListeners.spark_editing_started?.(data));
    this.socket.on('spark_editing_ended', (data) => this.eventListeners.spark_editing_ended?.(data));
    this.socket.on('spark_content_changed', (data) => this.eventListeners.spark_content_changed?.(data));
    this.socket.on('workspace_change', (data) => this.eventListeners.workspace_change?.(data));
    this.socket.on('workspace_invitation', (data) => this.eventListeners.workspace_invitation?.(data));
    this.socket.on('role_updated', (data) => this.eventListeners.role_updated?.(data));
    this.socket.on('workspace_removed', (data) => this.eventListeners.workspace_removed?.(data));
    this.socket.on('message', (data) => this.eventListeners.message?.(data));
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.connectionStatus = 'error';
      this.notifyStatusChange();
      return;
    }

    this.connectionStatus = 'reconnecting';
    this.notifyStatusChange();
    this.reconnectAttempts++;

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      if (this.socket && !this.socket.connected) {
        this.socket.connect();
      }
    }, delay);
  }

  private setupActivityTracking(): void {
    if (typeof window === 'undefined') return;

    const resetTimers = () => {
      this.clearPresenceTimers();
      
      if (this.currentUser?.status !== 'online') {
        this.updatePresence('online');
      }

      // Set idle after 5 minutes of inactivity
      this.idleTimer = setTimeout(() => {
        if (this.currentUser?.status === 'online') {
          this.updatePresence('idle');
        }

        // Set away after 15 minutes of inactivity
        this.awayTimer = setTimeout(() => {
          if (this.currentUser?.status === 'idle') {
            this.updatePresence('away');
          }
        }, 10 * 60 * 1000); // 10 more minutes for away
      }, 5 * 60 * 1000); // 5 minutes for idle
    };

    // Track user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, resetTimers, { passive: true });
    });

    // Track visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        resetTimers();
      }
    });
  }

  private clearPresenceTimers(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.awayTimer) {
      clearTimeout(this.awayTimer);
      this.awayTimer = null;
    }
  }

  private startPresenceTracking(): void {
    if (this.currentUser) {
      this.updatePresence('online');
    }
  }

  private notifyStatusChange(): void {
    this.eventListeners.connection_state_changed?.({
      connected: this.connectionStatus === 'connected'
    });
    console.log('Connection status changed:', this.connectionStatus);
  }

  /**
   * Add an event listener
   */
  addEventListener<K extends keyof SocketEvents>(
    event: K,
    listener: SocketEvents[K]
  ): void {
    this.eventListeners[event] = listener;
  }

  /**
   * Remove an event listener
   */
  removeEventListener<K extends keyof SocketEvents>(event: K): void {
    delete this.eventListeners[event];
  }

  /**
   * Emit workspace events
   */
  emitWorkspaceUpdate(workspaceId: string, update: any): void {
    if (!this.socket?.connected) return;
    this.socket.emit('workspace_updated', { workspaceId, update });
  }

  emitMemberInvited(workspaceId: string, member: any): void {
    if (!this.socket?.connected) return;
    this.socket.emit('member_invited', { workspaceId, member });
  }

  emitMemberRoleUpdated(workspaceId: string, userId: string, role: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit('member_role_updated', { workspaceId, userId, role });
  }

  emitMemberRemoved(workspaceId: string, userId: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit('member_removed', { workspaceId, userId });
  }
}

// Singleton instance - only create on client side
let socketClient: SocketClient | null = null;

export const getSocketClient = (): SocketClient => {
  if (typeof window === 'undefined') {
    // Return a mock client for server-side rendering
    return {
      connect: async () => Promise.resolve(),
      disconnect: () => {},
      isConnected: () => false,
      getSession: () => null,
      on: () => () => {},
      off: () => {},
      sendNotificationToUser: () => false,
      sendNotificationToWorkspace: () => false,
      acknowledgeNotification: () => {},
      updateUserStatus: () => false,
      getUserPresence: () => Promise.resolve({ users: [] }),
      joinWorkspace: () => false,
      leaveWorkspace: () => false,
      updatePresence: () => false,
      startEditingSpark: () => false,
      endEditingSpark: () => false,
      broadcastSparkChange: () => false,
      sendNotification: () => {},
      sendMessage: () => false,
      getConnectionStatus: () => 'disconnected' as ConnectionStatus,
    } as SocketClient;
  }

  if (!socketClient) {
    socketClient = new SocketClient();
  }
  
  return socketClient;
};

// Export for backward compatibility
export { getSocketClient as socketClient };