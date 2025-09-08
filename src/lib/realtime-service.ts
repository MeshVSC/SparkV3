import { create } from 'zustand';
import { socketClient, UserPresence, SparkEditingSession, ConnectionStatus } from './socket-client';

interface RealtimeState {
  // Connection state
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  
  // User presence
  connectedUsers: UserPresence[];
  currentUser: UserPresence | null;
  
  // Spark collaboration
  activeSparkSessions: SparkEditingSession[];
  editingSparks: Set<string>; // Spark IDs being edited by others
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  joinWorkspace: (userData: { userId: string; username: string; avatar?: string; workspaceId: string }) => void;
  leaveWorkspace: (workspaceId: string) => void;
  updatePresence: (status: 'online' | 'idle' | 'away') => void;
  startEditingSpark: (sparkId: string) => void;
  endEditingSpark: (sparkId: string) => void;
  broadcastSparkChange: (data: {
    sparkId: string;
    content: string;
    changeType: 'title' | 'description' | 'content' | 'status' | 'position';
    position?: { x: number; y: number };
  }) => void;
}

interface RealtimeEventCallbacks {
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
  onConnectionStatusChanged?: (status: ConnectionStatus) => void;
}

export const useRealtimeStore = create<RealtimeState>((set, get) => ({
  // Initial state
  connectionStatus: 'disconnected',
  isConnected: false,
  connectedUsers: [],
  currentUser: null,
  activeSparkSessions: [],
  editingSparks: new Set(),

  // Actions
  connect: async () => {
    try {
      await socketClient.connect();
      set({ connectionStatus: socketClient.getConnectionStatus(), isConnected: true });
    } catch (error) {
      console.error('Failed to connect to socket:', error);
      set({ connectionStatus: 'error', isConnected: false });
    }
  },

  disconnect: () => {
    socketClient.disconnect();
    set({
      connectionStatus: 'disconnected',
      isConnected: false,
      connectedUsers: [],
      currentUser: null,
      activeSparkSessions: [],
      editingSparks: new Set()
    });
  },

  joinWorkspace: (userData) => {
    socketClient.joinWorkspace(userData);
    set({
      currentUser: {
        ...userData,
        status: 'online' as const,
        lastSeen: new Date().toISOString()
      }
    });
  },

  leaveWorkspace: (workspaceId) => {
    socketClient.leaveWorkspace(workspaceId);
    set({
      currentUser: null,
      connectedUsers: [],
      activeSparkSessions: [],
      editingSparks: new Set()
    });
  },

  updatePresence: (status) => {
    socketClient.updatePresence(status);
    const currentUser = get().currentUser;
    if (currentUser) {
      set({
        currentUser: {
          ...currentUser,
          status,
          lastSeen: new Date().toISOString()
        }
      });
    }
  },

  startEditingSpark: (sparkId) => {
    socketClient.startEditingSpark(sparkId);
  },

  endEditingSpark: (sparkId) => {
    socketClient.endEditingSpark(sparkId);
  },

  broadcastSparkChange: (data) => {
    socketClient.broadcastSparkChange(data);
  }
}));

// Event handler setup
let eventHandlersSetup = false;

export class RealtimeService {
  private static instance: RealtimeService;
  private callbacks: RealtimeEventCallbacks = {};

  private constructor() {
    if (!eventHandlersSetup) {
      this.setupEventHandlers();
      eventHandlersSetup = true;
    }
  }

  static getInstance(): RealtimeService {
    if (!RealtimeService.instance) {
      RealtimeService.instance = new RealtimeService();
    }
    return RealtimeService.instance;
  }

  setCallbacks(callbacks: RealtimeEventCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  private setupEventHandlers(): void {
    // Connection events
    socketClient.on('connected', (data) => {
      console.log('Socket connected:', data);
      useRealtimeStore.setState({
        connectionStatus: 'connected',
        isConnected: true
      });
      this.callbacks.onConnectionStatusChanged?.('connected');
    });

    socketClient.on('disconnect', () => {
      console.log('Socket disconnected');
      useRealtimeStore.setState({
        connectionStatus: 'disconnected',
        isConnected: false,
        connectedUsers: [],
        activeSparkSessions: [],
        editingSparks: new Set()
      });
      this.callbacks.onConnectionStatusChanged?.('disconnected');
    });

    socketClient.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
      useRealtimeStore.setState({
        connectionStatus: 'connected',
        isConnected: true
      });
      this.callbacks.onConnectionStatusChanged?.('connected');
    });

    // User presence events
    socketClient.on('user_joined', (data) => {
      console.log('User joined:', data.user);
      useRealtimeStore.setState(state => ({
        connectedUsers: [...state.connectedUsers.filter(u => u.userId !== data.user.userId), data.user]
      }));
      this.callbacks.onUserJoined?.(data.user);
    });

    socketClient.on('user_left', (data) => {
      console.log('User left:', data.username);
      useRealtimeStore.setState(state => ({
        connectedUsers: state.connectedUsers.filter(u => u.userId !== data.userId),
        activeSparkSessions: state.activeSparkSessions.filter(s => s.userId !== data.userId),
        editingSparks: new Set(Array.from(state.editingSparks).filter(sparkId => {
          return !state.activeSparkSessions.some(s => s.sparkId === sparkId && s.userId === data.userId);
        }))
      }));
      this.callbacks.onUserLeft?.(data.userId, data.username);
    });

    socketClient.on('presence_updated', (data) => {
      console.log('Presence updated:', data);
      useRealtimeStore.setState(state => ({
        connectedUsers: state.connectedUsers.map(user =>
          user.userId === data.userId
            ? { ...user, status: data.status, lastSeen: data.lastSeen }
            : user
        )
      }));
      this.callbacks.onPresenceUpdated?.(data.userId, data.status, data.lastSeen);
    });

    socketClient.on('room_state', (data) => {
      console.log('Room state received:', data);
      useRealtimeStore.setState({
        connectedUsers: data.users,
        activeSparkSessions: data.activeSparks,
        editingSparks: new Set(data.activeSparks.map(s => s.sparkId))
      });
    });

    // Spark collaboration events
    socketClient.on('spark_editing_started', (data) => {
      console.log('Spark editing started:', data);
      const session: SparkEditingSession = {
        sparkId: data.sparkId,
        userId: data.userId,
        username: data.username,
        startedAt: data.startedAt
      };

      useRealtimeStore.setState(state => ({
        activeSparkSessions: [...state.activeSparkSessions.filter(s => 
          !(s.sparkId === data.sparkId && s.userId === data.userId)
        ), session],
        editingSparks: new Set([...state.editingSparks, data.sparkId])
      }));

      this.callbacks.onSparkEditingStarted?.(data.sparkId, data.userId, data.username);
    });

    socketClient.on('spark_editing_ended', (data) => {
      console.log('Spark editing ended:', data);
      useRealtimeStore.setState(state => {
        const remainingSessions = state.activeSparkSessions.filter(s => 
          !(s.sparkId === data.sparkId && s.userId === data.userId)
        );
        const stillEditing = remainingSessions.some(s => s.sparkId === data.sparkId);
        const newEditingSparks = new Set(state.editingSparks);
        
        if (!stillEditing) {
          newEditingSparks.delete(data.sparkId);
        }

        return {
          activeSparkSessions: remainingSessions,
          editingSparks: newEditingSparks
        };
      });

      this.callbacks.onSparkEditingEnded?.(data.sparkId, data.userId, data.username);
    });

    socketClient.on('spark_content_changed', (data) => {
      console.log('Spark content changed:', data);
      this.callbacks.onSparkContentChanged?.(data);
    });

    // Error handling
    socketClient.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      useRealtimeStore.setState({
        connectionStatus: 'error',
        isConnected: false
      });
      this.callbacks.onConnectionStatusChanged?.('error');
    });

    socketClient.on('reconnect_error', (error) => {
      console.error('Socket reconnection error:', error);
      useRealtimeStore.setState({
        connectionStatus: 'reconnecting',
        isConnected: false
      });
      this.callbacks.onConnectionStatusChanged?.('reconnecting');
    });

    socketClient.on('reconnect_failed', () => {
      console.error('Socket reconnection failed');
      useRealtimeStore.setState({
        connectionStatus: 'error',
        isConnected: false
      });
      this.callbacks.onConnectionStatusChanged?.('error');
    });
  }

  // Utility methods for common operations
  isSparkBeingEdited(sparkId: string): boolean {
    return useRealtimeStore.getState().editingSparks.has(sparkId);
  }

  getSparkEditors(sparkId: string): SparkEditingSession[] {
    return useRealtimeStore.getState().activeSparkSessions.filter(s => s.sparkId === sparkId);
  }

  getUsersInWorkspace(): UserPresence[] {
    return useRealtimeStore.getState().connectedUsers;
  }

  isUserOnline(userId: string): boolean {
    const user = useRealtimeStore.getState().connectedUsers.find(u => u.userId === userId);
    return user?.status === 'online';
  }

  getCurrentUser(): UserPresence | null {
    return useRealtimeStore.getState().currentUser;
  }
}

export const realtimeService = RealtimeService.getInstance();