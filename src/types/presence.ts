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

export interface PresenceState {
  users: PresenceUser[];
  cursors: UserCursor[];
  isConnected: boolean;
  error: string | null;
}

export interface JoinPresenceData {
  sparkId: string;
  userId: string;
  username: string;
  avatarUrl?: string;
}

export interface CursorUpdateData {
  sparkId: string;
  x: number;
  y: number;
}

export interface LeavePresenceData {
  sparkId: string;
}