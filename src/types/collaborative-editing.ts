// Types for collaborative editing system
export interface Operation {
  id: string;
  type: OperationType;
  sparkId: string;
  userId: string;
  timestamp: number;
  position: number;
  length?: number;
  text?: string;
  property?: string;
  value?: any;
  clientId: string;
  vectorClock: VectorClock;
}

export enum OperationType {
  INSERT = 'insert',
  DELETE = 'delete',
  RETAIN = 'retain',
  PROPERTY_UPDATE = 'property_update'
}

export interface VectorClock {
  [clientId: string]: number;
}

export interface TransformedOperation {
  operation: Operation;
  transformedAgainst: Operation[];
}

export interface OperationQueue {
  pending: Operation[];
  acknowledged: Operation[];
  local: Operation[];
}

export interface DocumentState {
  sparkId: string;
  content: string;
  version: number;
  vectorClock: VectorClock;
  lastOperation?: Operation;
}

export interface CollaborativeSession {
  sparkId: string;
  participants: Map<string, ParticipantInfo>;
  operationHistory: Operation[];
  documentState: DocumentState;
  created: Date;
  lastActivity: Date;
}

export interface ParticipantInfo {
  userId: string;
  clientId: string;
  username: string;
  lastSeen: Date;
  vectorClock: VectorClock;
}

export interface ConflictResolution {
  originalOperation: Operation;
  transformedOperations: Operation[];
  strategy: ConflictStrategy;
  resolved: boolean;
}

export enum ConflictStrategy {
  OPERATIONAL_TRANSFORM = 'operational_transform',
  LAST_WRITER_WINS = 'last_writer_wins',
  MERGE_CHANGES = 'merge_changes'
}

export interface SyncMessage {
  type: SyncMessageType;
  sparkId: string;
  operation?: Operation;
  operations?: Operation[];
  ack?: boolean;
  clientId: string;
  vectorClock: VectorClock;
}

export enum SyncMessageType {
  OPERATION = 'operation',
  ACK = 'ack',
  SYNC_REQUEST = 'sync_request',
  SYNC_RESPONSE = 'sync_response',
  JOIN_SESSION = 'join_session',
  LEAVE_SESSION = 'leave_session'
}