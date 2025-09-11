import { Server, Socket } from 'socket.io';
import { EventEmitter } from 'events';
import {
  Operation,
  OperationType,
  VectorClock,
  OperationQueue,
  DocumentState,
  CollaborativeSession,
  ParticipantInfo,
  SyncMessage,
  SyncMessageType,
  ConflictResolution,
  ConflictStrategy
} from '@/types/collaborative-editing';
import { OperationalTransform } from './OperationalTransform';
import { VectorClockManager } from './VectorClock';
import { prisma } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

/**
 * CollaborativeEditingService handles real-time synchronization of spark content
 * modifications across multiple users using operational transformation algorithms
 */
export class CollaborativeEditingService extends EventEmitter {
  private io: Server;
  private sessions: Map<string, CollaborativeSession> = new Map();
  private clientQueues: Map<string, OperationQueue> = new Map();
  private documentStates: Map<string, DocumentState> = new Map();
  private clientSessions: Map<string, string> = new Map(); // clientId -> sparkId

  constructor(io: Server) {
    super();
    this.io = io;
    this.setupSocketHandlers();
    this.startCleanupInterval();
  }

  /**
   * Setup Socket.IO event handlers for collaborative editing
   */
  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log('Client connected to collaborative editing:', socket.id);

      // Join collaborative session
      socket.on('join_collaboration', async (data: {
        sparkId: string;
        userId: string;
        username: string
      }) => {
        await this.handleJoinSession(socket, data);
      });

      // Leave collaborative session
      socket.on('leave_collaboration', (data: { sparkId: string }) => {
        this.handleLeaveSession(socket, data);
      });

      // Receive operation from client
      socket.on('collaborative_operation', (message: SyncMessage) => {
        this.handleOperation(socket, message);
      });

      // Request sync with server state
      socket.on('sync_request', (data: { sparkId: string }) => {
        this.handleSyncRequest(socket, data);
      });

      // Acknowledge received operation
      socket.on('operation_ack', (data: { operationId: string; sparkId: string }) => {
        this.handleOperationAck(socket, data);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  /**
   * Handle client joining a collaborative session
   */
  private async handleJoinSession(socket: Socket, data: {
    sparkId: string;
    userId: string;
    username: string
  }): Promise<void> {
    const { sparkId, userId, username } = data;
    const clientId = socket.id;

    try {
      // Get or create document state
      const documentState = await this.getOrCreateDocumentState(sparkId);

      // Get or create collaborative session
      let session = this.sessions.get(sparkId);
      if (!session) {
        session = await this.createCollaborativeSession(sparkId, documentState);
        this.sessions.set(sparkId, session);
      }

      // Add participant to session
      const participantInfo: ParticipantInfo = {
        userId,
        clientId,
        username,
        lastSeen: new Date(),
        vectorClock: VectorClockManager.init(clientId)
      };

      session.participants.set(clientId, participantInfo);
      session.lastActivity = new Date();

      // Track client session
      this.clientSessions.set(clientId, sparkId);

      // Initialize client operation queue
      this.clientQueues.set(clientId, {
        pending: [],
        acknowledged: [],
        local: []
      });

      // Join Socket.IO room for this spark
      socket.join(`spark_${sparkId}`);

      // Send current document state to client
      socket.emit('collaboration_state', {
        documentState,
        participants: Array.from(session.participants.values()),
        recentOperations: session.operationHistory.slice(-50) // Last 50 operations
      });

      // Notify other participants
      socket.to(`spark_${sparkId}`).emit('participant_joined', participantInfo);

      // Emit participant_joined event
      this.emit('participant_joined', {
        sparkId,
        participant: participantInfo,
        sessionParticipants: Array.from(session.participants.values())
      });

      console.log(`Client ${clientId} joined collaboration for spark ${sparkId}`);
    } catch (error) {
      console.error('Error joining collaborative session:', error);
      socket.emit('collaboration_error', { message: 'Failed to join collaborative session' });
    }
  }

  /**
   * Handle client leaving a collaborative session
   */
  private handleLeaveSession(socket: Socket, data: { sparkId: string }): void {
    const { sparkId } = data;
    const clientId = socket.id;

    const session = this.sessions.get(sparkId);
    if (session && session.participants.has(clientId)) {
      const participant = session.participants.get(clientId);
      session.participants.delete(clientId);

      // Clean up client data
      this.clientQueues.delete(clientId);
      this.clientSessions.delete(clientId);

      // Leave Socket.IO room
      socket.leave(`spark_${sparkId}`);

      // Notify other participants
      socket.to(`spark_${sparkId}`).emit('participant_left', participant);

      // Emit participant_left event
      this.emit('participant_left', {
        sparkId,
        participant,
        sessionParticipants: session ? Array.from(session.participants.values()) : []
      });

      // Clean up session if no participants
      if (session.participants.size === 0) {
        this.sessions.delete(sparkId);
      }

      console.log(`Client ${clientId} left collaboration for spark ${sparkId}`);
    }
  }

  /**
   * Handle operation from client
   */
  private async handleOperation(socket: Socket, message: SyncMessage): Promise<void> {
    if (!message.operation) return;

    const operation = message.operation;
    const clientId = socket.id;
    const sparkId = operation.sparkId;

    try {
      // Validate operation
      if (!this.validateOperation(operation)) {
        socket.emit('operation_error', {
          operationId: operation.id,
          message: 'Invalid operation'
        });
        return;
      }

      // Get session and document state
      const session = this.sessions.get(sparkId);
      const documentState = this.documentStates.get(sparkId);

      if (!session || !documentState) {
        socket.emit('operation_error', {
          operationId: operation.id,
          message: 'Session not found'
        });
        return;
      }

      // Update client's vector clock
      const participant = session.participants.get(clientId);
      if (participant) {
        participant.vectorClock = VectorClockManager.increment(participant.vectorClock, clientId);
        participant.lastSeen = new Date();
      }

      // Transform operation against concurrent operations
      const transformedOperation = await this.transformOperation(operation, session);

      // Apply operation to document state
      await this.applyOperation(transformedOperation, documentState);

      // Add to operation history
      session.operationHistory.push(transformedOperation);
      session.lastActivity = new Date();

      // Broadcast operation to other clients
      socket.to(`spark_${sparkId}`).emit('collaborative_operation', {
        type: SyncMessageType.OPERATION,
        sparkId,
        operation: transformedOperation,
        clientId,
        vectorClock: participant?.vectorClock || {}
      });

      // Send acknowledgment to originating client
      socket.emit('operation_ack', {
        operationId: operation.id,
        transformedOperation
      });

      // Persist operation to database
      await this.persistOperation(transformedOperation);

      // Emit operation_applied event
      this.emit('operation_applied', {
        operation: transformedOperation,
        sessionParticipants: Array.from(session.participants.values())
      });

      // Emit document_updated event
      this.emit('document_updated', {
        sparkId,
        version: documentState.version,
        lastOperation: transformedOperation,
        sessionParticipants: Array.from(session.participants.values())
      });

    } catch (error) {
      console.error('Error handling operation:', error);
      socket.emit('operation_error', {
        operationId: operation.id,
        message: 'Failed to process operation'
      });
    }
  }

  /**
   * Transform operation against concurrent operations using OT
   */
  private async transformOperation(
    operation: Operation,
    session: CollaborativeSession
  ): Promise<Operation> {
    // Get operations that happened concurrently
    const concurrentOps = session.operationHistory.filter(op =>
      op.clientId !== operation.clientId &&
      op.timestamp >= operation.timestamp - 5000 && // Within 5 seconds
      VectorClockManager.areConcurrent(op.vectorClock, operation.vectorClock)
    );

    let transformedOp = operation;

    // Transform against each concurrent operation
    for (const concurrentOp of concurrentOps) {
      const [transformed] = OperationalTransform.transform(transformedOp, concurrentOp);
      transformedOp = transformed;
    }

    return transformedOp;
  }

  /**
   * Apply operation to document state
   */
  private async applyOperation(operation: Operation, documentState: DocumentState): Promise<void> {
    switch (operation.type) {
      case OperationType.INSERT:
        if (operation.text) {
          const content = documentState.content || '';
          const newContent =
            content.slice(0, operation.position) +
            operation.text +
            content.slice(operation.position);
          documentState.content = newContent;
        }
        break;

      case OperationType.DELETE:
        if (operation.length) {
          const content = documentState.content || '';
          const newContent =
            content.slice(0, operation.position) +
            content.slice(operation.position + operation.length);
          documentState.content = newContent;
        }
        break;

      case OperationType.PROPERTY_UPDATE:
        // Handle property updates (title, description, etc.)
        if (operation.property && operation.value !== null) {
          await this.updateSparkProperty(operation.sparkId, operation.property, operation.value);
        }
        break;
    }

    // Update document state metadata
    documentState.version += 1;
    documentState.vectorClock = VectorClockManager.merge(
      documentState.vectorClock,
      operation.vectorClock
    );
    documentState.lastOperation = operation;

    // Update document state in memory
    this.documentStates.set(operation.sparkId, documentState);
  }

  /**
   * Handle sync request from client
   */
  private handleSyncRequest(socket: Socket, data: { sparkId: string }): void {
    const { sparkId } = data;
    const session = this.sessions.get(sparkId);
    const documentState = this.documentStates.get(sparkId);

    if (session && documentState) {
      socket.emit('sync_response', {
        type: SyncMessageType.SYNC_RESPONSE,
        sparkId,
        documentState,
        operations: session.operationHistory.slice(-100), // Last 100 operations
        participants: Array.from(session.participants.values())
      });
    }
  }

  /**
   * Handle operation acknowledgment from client
   */
  private handleOperationAck(socket: Socket, data: { operationId: string; sparkId: string }): void {
    const clientId = socket.id;
    const queue = this.clientQueues.get(clientId);

    if (queue) {
      // Move operation from pending to acknowledged
      const opIndex = queue.pending.findIndex(op => op.id === data.operationId);
      if (opIndex >= 0) {
        const [operation] = queue.pending.splice(opIndex, 1);
        queue.acknowledged.push(operation);
      }
    }
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(socket: Socket): void {
    const clientId = socket.id;
    const sparkId = this.clientSessions.get(clientId);

    if (sparkId) {
      this.handleLeaveSession(socket, { sparkId });
    }

    // Clean up client data
    this.clientQueues.delete(clientId);
    this.clientSessions.delete(clientId);
  }

  /**
   * Get or create document state for a spark
   */
  private async getOrCreateDocumentState(sparkId: string): Promise<DocumentState> {
    let documentState = this.documentStates.get(sparkId);

    if (!documentState) {
      // Load from database
      const spark = await prisma.spark.findUnique({
        where: { id: sparkId }
      });

      if (!spark) {
        throw new Error('Spark not found');
      }

      documentState = {
        sparkId,
        content: spark.content || '',
        version: 0,
        vectorClock: {},
        lastOperation: undefined
      };

      this.documentStates.set(sparkId, documentState);
    }

    return documentState;
  }

  /**
   * Create collaborative session
   */
  private async createCollaborativeSession(
    sparkId: string,
    documentState: DocumentState
  ): Promise<CollaborativeSession> {
    return {
      sparkId,
      participants: new Map(),
      operationHistory: [],
      documentState,
      created: new Date(),
      lastActivity: new Date()
    };
  }

  /**
   * Validate operation
   */
  private validateOperation(operation: Operation): boolean {
    if (!operation.id || !operation.sparkId || !operation.userId || !operation.clientId) {
      return false;
    }

    if (operation.type === OperationType.INSERT && !operation.text) {
      return false;
    }

    if (operation.type === OperationType.DELETE && (!operation.length || operation.length <= 0)) {
      return false;
    }

    if (operation.type === OperationType.PROPERTY_UPDATE && !operation.property) {
      return false;
    }

    return true;
  }

  /**
   * Persist operation to database
   */
  private async persistOperation(operation: Operation): Promise<void> {
    try {
      // Update spark content in database
      if (operation.type === OperationType.INSERT || operation.type === OperationType.DELETE) {
        const documentState = this.documentStates.get(operation.sparkId);
        if (documentState) {
          await prisma.spark.update({
            where: { id: operation.sparkId },
            data: {
              content: documentState.content,
              updatedAt: new Date()
            }
          });
        }
      }
    } catch (error) {
      console.error('Error persisting operation:', error);
    }
  }

  /**
   * Update spark property
   */
  private async updateSparkProperty(sparkId: string, property: string, value: any): Promise<void> {
    const updateData: any = { updatedAt: new Date() };

    if (property === 'title' || property === 'description' || property === 'status') {
      updateData[property] = value;
    }

    await prisma.spark.update({
      where: { id: sparkId },
      data: updateData
    });
  }

  /**
   * Resolve conflicts using operational transformation
   */
  private resolveConflicts(operations: Operation[]): ConflictResolution[] {
    const resolutions: ConflictResolution[] = [];

    for (let i = 0; i < operations.length; i++) {
      for (let j = i + 1; j < operations.length; j++) {
        const op1 = operations[i];
        const op2 = operations[j];

        // Check if operations conflict
        if (this.operationsConflict(op1, op2)) {
          const [transformed1, transformed2] = OperationalTransform.transform(op1, op2);

          resolutions.push({
            originalOperation: op1,
            transformedOperations: [transformed1],
            strategy: ConflictStrategy.OPERATIONAL_TRANSFORM,
            resolved: true
          });

          resolutions.push({
            originalOperation: op2,
            transformedOperations: [transformed2],
            strategy: ConflictStrategy.OPERATIONAL_TRANSFORM,
            resolved: true
          });
        }
      }
    }

    return resolutions;
  }

  /**
   * Check if two operations conflict
   */
  private operationsConflict(op1: Operation, op2: Operation): boolean {
    if (op1.sparkId !== op2.sparkId) return false;

    // Text operations on overlapping ranges conflict
    if ((op1.type === OperationType.INSERT || op1.type === OperationType.DELETE) &&
        (op2.type === OperationType.INSERT || op2.type === OperationType.DELETE)) {
      const op1End = op1.position + (op1.length || op1.text?.length || 0);
      const op2End = op2.position + (op2.length || op2.text?.length || 0);

      return !(op1End <= op2.position || op2End <= op1.position);
    }

    // Property updates on the same property conflict
    if (op1.type === OperationType.PROPERTY_UPDATE &&
        op2.type === OperationType.PROPERTY_UPDATE) {
      return op1.property === op2.property;
    }

    return false;
  }

  /**
   * Start cleanup interval to remove inactive sessions
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const now = new Date();
      const maxInactiveTime = 30 * 60 * 1000; // 30 minutes

      for (const [sparkId, session] of this.sessions.entries()) {
        if (now.getTime() - session.lastActivity.getTime() > maxInactiveTime) {
          console.log(`Cleaning up inactive session for spark ${sparkId}`);
          this.sessions.delete(sparkId);
          this.documentStates.delete(sparkId);
        }
      }
    }, 5 * 60 * 1000); // Run every 5 minutes
  }

  /**
   * Get active sessions for monitoring
   */
  public getActiveSessions(): { sparkId: string; participantCount: number; lastActivity: Date }[] {
    return Array.from(this.sessions.entries()).map(([sparkId, session]) => ({
      sparkId,
      participantCount: session.participants.size,
      lastActivity: session.lastActivity
    }));
  }

  /**
   * Force sync all clients in a session
   */
  public async forceSyncSession(sparkId: string): Promise<void> {
    const session = this.sessions.get(sparkId);
    const documentState = this.documentStates.get(sparkId);

    if (session && documentState) {
      this.io.to(`spark_${sparkId}`).emit('force_sync', {
        documentState,
        operations: session.operationHistory.slice(-100)
      });
    }
  }
}
