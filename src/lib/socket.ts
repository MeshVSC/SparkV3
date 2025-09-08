import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { getToken } from 'next-auth/jwt';

interface UserPresence {
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

interface SparkEditingSession {
  sparkId: string;
  userId: string;
  username: string;
  startedAt: string;
}

interface CollaborationRoom {
  workspaceId: string;
  users: Map<string, UserPresence>;
  activeSparks: Map<string, SparkEditingSession>;
}

interface UserSession {
  userId: string;
  username: string;
  email: string;
  avatar?: string;
  socketIds: Set<string>;
  lastActivity: Date;
  authenticatedAt: Date;
}

interface AuthenticatedSocket extends Socket {
  userId?: string;
  sessionId?: string;
}

interface NotificationEvent {
  id: string;
  type: string;
  title: string;
  message: string;
  userId: string;
  data?: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  channels: string[];
  timestamp: string;
}

const collaborationRooms = new Map<string, CollaborationRoom>();
const userSessions = new Map<string, UserSession>(); // userId -> UserSession
const socketToUser = new Map<string, string>(); // socketId -> userId
const notificationQueues = new Map<string, NotificationEvent[]>(); // userId -> pending notifications

// Authentication middleware for socket connections
const authenticateSocket = async (socket: AuthenticatedSocket): Promise<boolean> => {
  try {
    // Get token from handshake auth (client should send token during connection)
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    
    if (!token) {
      socket.emit('auth_error', { message: 'No authentication token provided' });
      return false;
    }

    // Verify JWT token (assuming NextAuth uses JWT)
    const decodedToken = jwt.verify(token, process.env.NEXTAUTH_SECRET || 'fallback-secret') as any;
    
    if (!decodedToken || !decodedToken.sub) {
      socket.emit('auth_error', { message: 'Invalid token' });
      return false;
    }

    const userId = decodedToken.sub;
    const email = decodedToken.email;
    const name = decodedToken.name;

    // Set user info on socket
    socket.userId = userId;
    socket.sessionId = `${userId}_${Date.now()}`;

    // Join user-specific room for targeted notifications
    socket.join(`user_${userId}`);
    
    // Track socket to user mapping
    socketToUser.set(socket.id, userId);

    // Update or create user session
    let userSession = userSessions.get(userId);
    if (!userSession) {
      userSession = {
        userId,
        username: name || email,
        email,
        socketIds: new Set([socket.id]),
        lastActivity: new Date(),
        authenticatedAt: new Date()
      };
      userSessions.set(userId, userSession);
      console.log(`New user session created for ${name} (${userId})`);
    } else {
      userSession.socketIds.add(socket.id);
      userSession.lastActivity = new Date();
      console.log(`User ${name} connected on additional socket. Active sockets: ${userSession.socketIds.size}`);
    }

    // Send pending notifications if any
    const pendingNotifications = notificationQueues.get(userId) || [];
    if (pendingNotifications.length > 0) {
      socket.emit('pending_notifications', pendingNotifications);
      notificationQueues.delete(userId);
    }

    // Emit authentication success
    socket.emit('authenticated', {
      userId,
      username: userSession.username,
      email: userSession.email,
      sessionId: socket.sessionId,
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error) {
    console.error('Socket authentication error:', error);
    socket.emit('auth_error', { message: 'Authentication failed' });
    return false;
  }
};

// Clean up user session when socket disconnects
const cleanupUserSession = (socketId: string) => {
  const userId = socketToUser.get(socketId);
  if (!userId) return;

  const userSession = userSessions.get(userId);
  if (userSession) {
    userSession.socketIds.delete(socketId);
    
    if (userSession.socketIds.size === 0) {
      // No more active connections, remove session
      userSessions.delete(userId);
      console.log(`User session removed for user ${userId}`);
    } else {
      console.log(`Socket disconnected for user ${userId}. Remaining sockets: ${userSession.socketIds.size}`);
    }
  }
  
  socketToUser.delete(socketId);
};

// Send notification to specific user across all their connections
const sendNotificationToUser = (userId: string, notification: NotificationEvent, io: Server) => {
  const userRoom = `user_${userId}`;
  
  // Check if user has active sessions
  const userSession = userSessions.get(userId);
  if (userSession && userSession.socketIds.size > 0) {
    // User is online, send immediately
    io.to(userRoom).emit('notification_received', notification);
    console.log(`Notification sent to user ${userId} across ${userSession.socketIds.size} connections`);
  } else {
    // User is offline, queue notification
    if (!notificationQueues.has(userId)) {
      notificationQueues.set(userId, []);
    }
    notificationQueues.get(userId)!.push(notification);
    console.log(`Notification queued for offline user ${userId}`);
  }
};

export const setupSocket = (io: Server) => {
  // Middleware to authenticate every connection
  io.use(async (socket: AuthenticatedSocket, next) => {
    const isAuthenticated = await authenticateSocket(socket);
    if (isAuthenticated) {
      next();
    } else {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log('Authenticated client connected:', socket.id, 'User:', socket.userId);
    let userPresence: UserPresence | null = null;
    let currentRoom: string | null = null;

    // User joins a workspace room
    socket.on('user_join', (data: { userId: string; username: string; avatar?: string; workspaceId: string }) => {
      const { userId, username, avatar, workspaceId } = data;
      
      // Leave previous room if any
      if (currentRoom) {
        socket.leave(currentRoom);
        handleUserLeave(currentRoom, socket.id);
      }

      // Join new room
      const roomKey = `workspace_${workspaceId}`;
      socket.join(roomKey);
      currentRoom = roomKey;

      // Create or get collaboration room
      if (!collaborationRooms.has(roomKey)) {
        collaborationRooms.set(roomKey, {
          workspaceId,
          users: new Map(),
          activeSparks: new Map()
        });
      }

      const room = collaborationRooms.get(roomKey)!;
      
      // Update user presence
      userPresence = {
        userId,
        username,
        avatar,
        workspaceId,
        status: 'online',
        lastSeen: new Date().toISOString()
      };

      room.users.set(socket.id, userPresence);

      // Broadcast user joined to room
      socket.to(roomKey).emit('user_joined', {
        user: userPresence,
        timestamp: new Date().toISOString()
      });

      // Send current room state to joining user
      socket.emit('room_state', {
        users: Array.from(room.users.values()),
        activeSparks: Array.from(room.activeSparks.values()),
        timestamp: new Date().toISOString()
      });

      console.log(`User ${username} joined workspace ${workspaceId}`);
    });

    // User leaves workspace
    socket.on('user_leave', (data: { workspaceId: string }) => {
      const roomKey = `workspace_${data.workspaceId}`;
      handleUserLeave(roomKey, socket.id);
      socket.leave(roomKey);
      currentRoom = null;
    });

    // Presence update (online, idle, away)
    socket.on('presence_update', (data: { status: 'online' | 'idle' | 'away' }) => {
      if (currentRoom && userPresence) {
        const room = collaborationRooms.get(currentRoom);
        if (room && room.users.has(socket.id)) {
          userPresence.status = data.status;
          userPresence.lastSeen = new Date().toISOString();
          room.users.set(socket.id, userPresence);

          // Broadcast presence update
          socket.to(currentRoom).emit('presence_updated', {
            userId: userPresence.userId,
            status: data.status,
            lastSeen: userPresence.lastSeen,
            timestamp: new Date().toISOString()
          });
        }
      }
    });

    // Cursor position update
    socket.on('cursor_update', (data: { x: number; y: number }) => {
      if (currentRoom && userPresence) {
        const room = collaborationRooms.get(currentRoom);
        if (room && room.users.has(socket.id)) {
          userPresence.cursor = {
            x: data.x,
            y: data.y,
            lastUpdate: new Date().toISOString()
          };
          room.users.set(socket.id, userPresence);

          // Broadcast cursor update to room members
          socket.to(currentRoom).emit('cursor_updated', {
            userId: userPresence.userId,
            username: userPresence.username,
            cursor: userPresence.cursor,
            timestamp: new Date().toISOString()
          });
        }
      }
    });

    // Spark editing started
    socket.on('spark_editing_start', (data: { sparkId: string }) => {
      if (currentRoom && userPresence) {
        const room = collaborationRooms.get(currentRoom);
        if (room) {
          const editingSession: SparkEditingSession = {
            sparkId: data.sparkId,
            userId: userPresence.userId,
            username: userPresence.username,
            startedAt: new Date().toISOString()
          };

          room.activeSparks.set(`${data.sparkId}_${socket.id}`, editingSession);

          // Broadcast editing started
          socket.to(currentRoom).emit('spark_editing_started', {
            ...editingSession,
            timestamp: new Date().toISOString()
          });
        }
      }
    });

    // Spark editing ended
    socket.on('spark_editing_end', (data: { sparkId: string }) => {
      if (currentRoom && userPresence) {
        const room = collaborationRooms.get(currentRoom);
        if (room) {
          const sessionKey = `${data.sparkId}_${socket.id}`;
          const editingSession = room.activeSparks.get(sessionKey);
          
          if (editingSession) {
            room.activeSparks.delete(sessionKey);

            // Broadcast editing ended
            socket.to(currentRoom).emit('spark_editing_ended', {
              sparkId: data.sparkId,
              userId: userPresence.userId,
              username: userPresence.username,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    });

    // Spark content change (real-time collaboration)
    socket.on('spark_content_change', (data: { 
      sparkId: string; 
      content: string; 
      changeType: 'title' | 'description' | 'content' | 'status' | 'position';
      position?: { x: number; y: number };
    }) => {
      if (currentRoom && userPresence) {
        // Broadcast content change to all room members except sender
        socket.to(currentRoom).emit('spark_content_changed', {
          sparkId: data.sparkId,
          content: data.content,
          changeType: data.changeType,
          position: data.position,
          userId: userPresence.userId,
          username: userPresence.username,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Enhanced notification handler for user-specific targeting
    socket.on('send_notification', async (data: {
      targetUserId: string;
      type: string;
      title: string;
      message: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      data?: Record<string, any>;
    }) => {
      if (!socket.userId) return;

      const notification: NotificationEvent = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: data.type,
        title: data.title,
        message: data.message,
        userId: data.targetUserId,
        data: data.data,
        priority: data.priority || 'medium',
        channels: ['in_app'],
        timestamp: new Date().toISOString()
      };

      sendNotificationToUser(data.targetUserId, notification, io);
    });

    // Notification acknowledgment
    socket.on('acknowledge_notification', (data: { notificationId: string }) => {
      if (!socket.userId) return;
      
      console.log(`Notification ${data.notificationId} acknowledged by user ${socket.userId}`);
      // Could update database or analytics here
    });

    // Get user presence for all connections
    socket.on('get_user_presence', (callback) => {
      const onlineUsers = Array.from(userSessions.values()).map(session => ({
        userId: session.userId,
        username: session.username,
        email: session.email,
        avatar: session.avatar,
        activeConnections: session.socketIds.size,
        lastActivity: session.lastActivity.toISOString(),
        isOnline: session.socketIds.size > 0
      }));
      
      if (callback) callback({ users: onlineUsers });
    });

    // Heartbeat to keep connection alive and track activity
    socket.on('heartbeat', () => {
      if (socket.userId) {
        const userSession = userSessions.get(socket.userId);
        if (userSession) {
          userSession.lastActivity = new Date();
        }
      }
      socket.emit('heartbeat_ack', { timestamp: new Date().toISOString() });
    });

    // Handle disconnect with enhanced cleanup
    socket.on('disconnect', (reason) => {
      console.log('Client disconnected:', socket.id, 'User:', socket.userId, 'Reason:', reason);
      
      if (currentRoom) {
        handleUserLeave(currentRoom, socket.id);
      }
      
      // Clean up user session tracking
      cleanupUserSession(socket.id);
    });

    // Legacy notification handler (for backwards compatibility)
    socket.on('notification', (data: any) => {
      // Enhanced to use the new user-specific notification system
      if (socket.userId) {
        const notification: NotificationEvent = {
          id: `legacy_notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: data.type || 'general',
          title: data.title || 'Notification',
          message: data.message || data.text || 'You have a new notification',
          userId: socket.userId,
          data,
          priority: data.priority || 'medium',
          channels: ['in_app'],
          timestamp: new Date().toISOString()
        };

        // If specific target user is provided, send to them; otherwise send to current user
        const targetUserId = data.targetUserId || socket.userId;
        sendNotificationToUser(targetUserId, notification, io);
      } else if (currentRoom && userPresence) {
        // Fallback to room-based broadcast for unauthenticated connections
        socket.to(currentRoom).emit('notification_received', {
          ...data,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Comment system events
    socket.on('join_entity', (data: { entityId: string; entityType: string }) => {
      const entityRoom = `entity_${data.entityType}_${data.entityId}`;
      socket.join(entityRoom);
      console.log(`Socket ${socket.id} joined entity room: ${entityRoom}`);
    });

    socket.on('leave_entity', (data: { entityId: string; entityType: string }) => {
      const entityRoom = `entity_${data.entityType}_${data.entityId}`;
      socket.leave(entityRoom);
      console.log(`Socket ${socket.id} left entity room: ${entityRoom}`);
    });

    // Handle workspace operations
    socket.on('workspace_updated', (data: { workspaceId: string; update: any }) => {
      socket.to(`workspace_${data.workspaceId}`).emit('workspace_change', {
        type: 'workspace_updated',
        workspaceId: data.workspaceId,
        data: data.update,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('member_invited', (data: { workspaceId: string; member: any }) => {
      socket.to(`workspace_${data.workspaceId}`).emit('workspace_change', {
        type: 'member_invited',
        workspaceId: data.workspaceId,
        data: data.member,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('member_role_updated', (data: { workspaceId: string; userId: string; role: string }) => {
      socket.to(`workspace_${data.workspaceId}`).emit('workspace_change', {
        type: 'member_role_updated',
        workspaceId: data.workspaceId,
        data: { userId: data.userId, role: data.role },
        timestamp: new Date().toISOString()
      });
    });

    socket.on('member_removed', (data: { workspaceId: string; userId: string }) => {
      socket.to(`workspace_${data.workspaceId}`).emit('workspace_change', {
        type: 'member_removed',
        workspaceId: data.workspaceId,
        data: { userId: data.userId },
        timestamp: new Date().toISOString()
      });
    });

    // Comment typing indicators
    socket.on('comment_typing_start', (data: { entityId: string; entityType: string; parentId?: string }) => {
      if (userPresence) {
        const entityRoom = `entity_${data.entityType}_${data.entityId}`;
        socket.to(entityRoom).emit('user_typing', {
          userId: userPresence.userId,
          username: userPresence.username,
          entityId: data.entityId,
          entityType: data.entityType,
          parentId: data.parentId,
          timestamp: new Date().toISOString()
        });
      }
    });

    socket.on('comment_typing_end', (data: { entityId: string; entityType: string; parentId?: string }) => {
      if (userPresence) {
        const entityRoom = `entity_${data.entityType}_${data.entityId}`;
        socket.to(entityRoom).emit('user_stopped_typing', {
          userId: userPresence.userId,
          entityId: data.entityId,
          entityType: data.entityType,
          parentId: data.parentId,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Legacy message handler for backwards compatibility
    socket.on('message', (msg: { text: string; senderId: string }) => {
      socket.emit('message', {
        text: `Echo: ${msg.text}`,
        senderId: 'system',
        timestamp: new Date().toISOString(),
      });
    });

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to collaboration server',
      socketId: socket.id,
      timestamp: new Date().toISOString(),
    });
  });

  // Helper function to handle user leaving
  function handleUserLeave(roomKey: string, socketId: string) {
    const room = collaborationRooms.get(roomKey);
    if (room) {
      const user = room.users.get(socketId);
      if (user) {
        // Remove user from room
        room.users.delete(socketId);

        // Remove any active spark editing sessions for this user
        const userSparkSessions = Array.from(room.activeSparks.entries())
          .filter(([key]) => key.endsWith(`_${socketId}`));
        
        for (const [sessionKey, session] of userSparkSessions) {
          room.activeSparks.delete(sessionKey);
          
          // Broadcast editing ended
          io.to(roomKey).emit('spark_editing_ended', {
            sparkId: session.sparkId,
            userId: session.userId,
            username: session.username,
            timestamp: new Date().toISOString()
          });
        }

        // Broadcast user left
        io.to(roomKey).emit('user_left', {
          userId: user.userId,
          username: user.username,
          timestamp: new Date().toISOString()
        });

        // Clean up empty rooms
        if (room.users.size === 0) {
          collaborationRooms.delete(roomKey);
        }

        console.log(`User ${user.username} left workspace ${user.workspaceId}`);
      }
    }
  }

  // Expose methods for external notification integration
  io.notificationService = {
    sendToUser: (userId: string, notification: NotificationEvent) => {
      sendNotificationToUser(userId, notification, io);
    },
    
    sendToWorkspace: (workspaceId: string, notification: NotificationEvent) => {
      const roomKey = `workspace_${workspaceId}`;
      io.to(roomKey).emit('notification_received', notification);
    },
    
    broadcastToAll: (notification: NotificationEvent) => {
      io.emit('notification_received', notification);
    },
    
    getOnlineUsers: () => {
      return Array.from(userSessions.values()).map(session => ({
        userId: session.userId,
        username: session.username,
        email: session.email,
        activeConnections: session.socketIds.size,
        lastActivity: session.lastActivity
      }));
    },
    
    getUserSession: (userId: string) => {
      return userSessions.get(userId);
    }
  };
};