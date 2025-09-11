import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

export interface UserCursor {
  userId: string;
  username: string;
  avatarUrl?: string;
  x: number;
  y: number;
  lastUpdate: Date;
  color: string;
}

export interface PresenceUser {
  userId: string;
  username: string;
  avatarUrl?: string;
  socketId: string;
  joinedAt: Date;
  lastSeen: Date;
  cursor?: UserCursor;
  color: string;
}

export interface PresenceRoom {
  sparkId: string;
  users: Map<string, PresenceUser>;
  cursors: Map<string, UserCursor>;
  created: Date;
  lastActivity: Date;
}

/**
 * Real-time user presence service that manages Socket.IO room connections
 * and tracks active users per spark or canvas session
 */
export class PresenceService {
  private io: Server;
  private rooms: Map<string, PresenceRoom> = new Map();
  private userColors: string[] = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#82E0AA', '#F8C471'
  ];

  constructor(io: Server) {
    this.io = io;
    this.setupSocketHandlers();
    this.startCleanupInterval();
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log('Client connected to presence service:', socket.id);

      // Join presence room for a spark
      socket.on('join_presence', async (data: {
        sparkId: string;
        userId: string;
        username: string;
        avatarUrl?: string;
      }) => {
        await this.handleJoinPresence(socket, data);
      });

      // Leave presence room
      socket.on('leave_presence', (data: { sparkId: string }) => {
        this.handleLeavePresence(socket, data);
      });

      // Update cursor position
      socket.on('cursor_update', (data: {
        sparkId: string;
        x: number;
        y: number;
      }) => {
        this.handleCursorUpdate(socket, data);
      });

      // Hide cursor
      socket.on('cursor_hide', (data: { sparkId: string }) => {
        this.handleCursorHide(socket, data);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private async handleJoinPresence(socket: Socket, data: {
    sparkId: string;
    userId: string;
    username: string;
    avatarUrl?: string;
  }): Promise<void> {
    const { sparkId, userId, username, avatarUrl } = data;
    const socketId = socket.id;

    try {
      // Get or create presence room
      let room = this.rooms.get(sparkId);
      if (!room) {
        room = {
          sparkId,
          users: new Map(),
          cursors: new Map(),
          created: new Date(),
          lastActivity: new Date()
        };
        this.rooms.set(sparkId, room);
      }

      // Assign a color to the user
      const color = this.assignUserColor(room, userId);

      // Create presence user
      const presenceUser: PresenceUser = {
        userId,
        username,
        avatarUrl,
        socketId,
        joinedAt: new Date(),
        lastSeen: new Date(),
        color
      };

      // Add user to room
      room.users.set(userId, presenceUser);
      room.lastActivity = new Date();

      // Join Socket.IO room
      socket.join(`presence_${sparkId}`);

      // Send current room state to joining user
      socket.emit('presence_state', {
        users: Array.from(room.users.values()),
        cursors: Array.from(room.cursors.values())
      });

      // Notify other users in the room
      socket.to(`presence_${sparkId}`).emit('user_joined', presenceUser);

      console.log(`User ${userId} joined presence room for spark ${sparkId}`);
    } catch (error) {
      console.error('Error joining presence room:', error);
      socket.emit('presence_error', { message: 'Failed to join presence room' });
    }
  }

  private handleLeavePresence(socket: Socket, data: { sparkId: string }): void {
    const { sparkId } = data;
    const socketId = socket.id;

    const room = this.rooms.get(sparkId);
    if (!room) return;

    // Find user by socket ID
    const user = Array.from(room.users.values()).find(u => u.socketId === socketId);
    if (!user) return;

    // Remove user from room
    room.users.delete(user.userId);
    room.cursors.delete(user.userId);

    // Leave Socket.IO room
    socket.leave(`presence_${sparkId}`);

    // Notify other users
    socket.to(`presence_${sparkId}`).emit('user_left', { userId: user.userId });

    // Clean up empty room
    if (room.users.size === 0) {
      this.rooms.delete(sparkId);
    }

    console.log(`User ${user.userId} left presence room for spark ${sparkId}`);
  }

  private handleCursorUpdate(socket: Socket, data: {
    sparkId: string;
    x: number;
    y: number;
  }): void {
    const { sparkId, x, y } = data;
    const socketId = socket.id;

    const room = this.rooms.get(sparkId);
    if (!room) return;

    // Find user by socket ID
    const user = Array.from(room.users.values()).find(u => u.socketId === socketId);
    if (!user) return;

    // Update cursor position
    const cursor: UserCursor = {
      userId: user.userId,
      username: user.username,
      avatarUrl: user.avatarUrl,
      x,
      y,
      lastUpdate: new Date(),
      color: user.color
    };

    room.cursors.set(user.userId, cursor);
    user.cursor = cursor;
    user.lastSeen = new Date();
    room.lastActivity = new Date();

    // Broadcast cursor update to other users
    socket.to(`presence_${sparkId}`).emit('cursor_moved', cursor);
  }

  private handleCursorHide(socket: Socket, data: { sparkId: string }): void {
    const { sparkId } = data;
    const socketId = socket.id;

    const room = this.rooms.get(sparkId);
    if (!room) return;

    // Find user by socket ID
    const user = Array.from(room.users.values()).find(u => u.socketId === socketId);
    if (!user) return;

    // Remove cursor from room
    room.cursors.delete(user.userId);
    user.cursor = undefined;

    // Broadcast cursor hide to other users
    socket.to(`presence_${sparkId}`).emit('cursor_hidden', { userId: user.userId });
  }

  private handleDisconnect(socket: Socket): void {
    const socketId = socket.id;

    // Find and remove user from all rooms
    for (const [sparkId, room] of this.rooms.entries()) {
      const user = Array.from(room.users.values()).find(u => u.socketId === socketId);
      if (user) {
        this.handleLeavePresence(socket, { sparkId });
        break; // User can only be in one room at a time
      }
    }
  }

  private assignUserColor(room: PresenceRoom, userId: string): string {
    // Check if user already has a color assigned
    const existingUser = room.users.get(userId);
    if (existingUser) {
      return existingUser.color;
    }

    // Find an unused color
    const usedColors = new Set(Array.from(room.users.values()).map(u => u.color));
    const availableColors = this.userColors.filter(color => !usedColors.has(color));
    
    // If all colors are used, cycle through them
    if (availableColors.length === 0) {
      return this.userColors[room.users.size % this.userColors.length];
    }

    return availableColors[0];
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      const now = new Date();
      const maxInactiveTime = 5 * 60 * 1000; // 5 minutes

      for (const [sparkId, room] of this.rooms.entries()) {
        // Remove inactive cursors
        for (const [userId, cursor] of room.cursors.entries()) {
          if (now.getTime() - cursor.lastUpdate.getTime() > 30 * 1000) { // 30 seconds
            room.cursors.delete(userId);
            // Notify other users that cursor disappeared
            this.io.to(`presence_${sparkId}`).emit('cursor_disappeared', { userId });
          }
        }

        // Clean up inactive rooms
        if (now.getTime() - room.lastActivity.getTime() > maxInactiveTime) {
          console.log(`Cleaning up inactive presence room for spark ${sparkId}`);
          this.rooms.delete(sparkId);
        }
      }
    }, 30 * 1000); // Run every 30 seconds
  }

  /**
   * Get active users in a spark room
   */
  public getActiveUsers(sparkId: string): PresenceUser[] {
    const room = this.rooms.get(sparkId);
    return room ? Array.from(room.users.values()) : [];
  }

  /**
   * Get cursor positions for a spark room
   */
  public getCursors(sparkId: string): UserCursor[] {
    const room = this.rooms.get(sparkId);
    return room ? Array.from(room.cursors.values()) : [];
  }

  /**
   * Get all active rooms for monitoring
   */
  public getActiveRooms(): { sparkId: string; userCount: number; lastActivity: Date }[] {
    return Array.from(this.rooms.entries()).map(([sparkId, room]) => ({
      sparkId,
      userCount: room.users.size,
      lastActivity: room.lastActivity
    }));
  }

  /**
   * Force update presence state for a room
   */
  public forceUpdateRoom(sparkId: string): void {
    const room = this.rooms.get(sparkId);
    if (room) {
      this.io.to(`presence_${sparkId}`).emit('presence_state', {
        users: Array.from(room.users.values()),
        cursors: Array.from(room.cursors.values())
      });
    }
  }
}