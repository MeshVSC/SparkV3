import { useState, useEffect, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { 
  Operation, 
  OperationType, 
  DocumentState, 
  ParticipantInfo, 
  SyncMessage, 
  SyncMessageType,
  VectorClock
} from '@/types/collaborative-editing';
import { VectorClockManager } from '@/lib/collaborative-editing/VectorClock';
import { v4 as uuidv4 } from 'uuid';

interface UseCollaborativeEditingProps {
  socket: Socket | null;
  sparkId: string;
  userId: string;
  username: string;
}

interface CollaborativeEditingState {
  isConnected: boolean;
  participants: ParticipantInfo[];
  documentState: DocumentState | null;
  pendingOperations: Operation[];
  isReady: boolean;
}

export function useCollaborativeEditing({ 
  socket, 
  sparkId, 
  userId, 
  username 
}: UseCollaborativeEditingProps) {
  const [state, setState] = useState<CollaborativeEditingState>({
    isConnected: false,
    participants: [],
    documentState: null,
    pendingOperations: [],
    isReady: false
  });

  const clientId = useRef<string>('');
  const vectorClock = useRef<VectorClock>({});
  const operationQueue = useRef<Operation[]>([]);

  // Initialize client ID and vector clock
  useEffect(() => {
    if (socket) {
      clientId.current = socket.id;
      vectorClock.current = VectorClockManager.init(clientId.current);
    }
  }, [socket]);

  // Join collaborative session
  const joinCollaboration = useCallback(() => {
    if (!socket || !sparkId) return;

    socket.emit('join_collaboration', {
      sparkId,
      userId,
      username
    });
  }, [socket, sparkId, userId, username]);

  // Leave collaborative session
  const leaveCollaboration = useCallback(() => {
    if (!socket || !sparkId) return;

    socket.emit('leave_collaboration', { sparkId });
  }, [socket, sparkId]);

  // Send operation to server
  const sendOperation = useCallback((operation: Omit<Operation, 'id' | 'clientId' | 'vectorClock' | 'timestamp'>) => {
    if (!socket || !state.isReady) return;

    // Increment vector clock
    vectorClock.current = VectorClockManager.increment(vectorClock.current, clientId.current);

    const fullOperation: Operation = {
      ...operation,
      id: uuidv4(),
      clientId: clientId.current,
      vectorClock: { ...vectorClock.current },
      timestamp: Date.now()
    };

    // Add to pending operations
    operationQueue.current.push(fullOperation);
    setState(prev => ({
      ...prev,
      pendingOperations: [...prev.pendingOperations, fullOperation]
    }));

    // Send to server
    const message: SyncMessage = {
      type: SyncMessageType.OPERATION,
      sparkId,
      operation: fullOperation,
      clientId: clientId.current,
      vectorClock: vectorClock.current
    };

    socket.emit('collaborative_operation', message);
  }, [socket, sparkId, state.isReady]);

  // Create text insert operation
  const insertText = useCallback((position: number, text: string) => {
    sendOperation({
      type: OperationType.INSERT,
      sparkId,
      userId,
      position,
      text
    });
  }, [sendOperation, sparkId, userId]);

  // Create text delete operation
  const deleteText = useCallback((position: number, length: number) => {
    sendOperation({
      type: OperationType.DELETE,
      sparkId,
      userId,
      position,
      length
    });
  }, [sendOperation, sparkId, userId]);

  // Update spark property
  const updateProperty = useCallback((property: string, value: any) => {
    sendOperation({
      type: OperationType.PROPERTY_UPDATE,
      sparkId,
      userId,
      position: 0,
      property,
      value
    });
  }, [sendOperation, sparkId, userId]);

  // Request sync with server
  const requestSync = useCallback(() => {
    if (!socket) return;

    socket.emit('sync_request', { sparkId });
  }, [socket, sparkId]);

  // Apply remote operation to local state
  const applyRemoteOperation = useCallback((operation: Operation) => {
    setState(prev => {
      if (!prev.documentState) return prev;

      const newDocumentState = { ...prev.documentState };

      switch (operation.type) {
        case OperationType.INSERT:
          if (operation.text) {
            const content = newDocumentState.content || '';
            newDocumentState.content = 
              content.slice(0, operation.position) + 
              operation.text + 
              content.slice(operation.position);
          }
          break;

        case OperationType.DELETE:
          if (operation.length) {
            const content = newDocumentState.content || '';
            newDocumentState.content = 
              content.slice(0, operation.position) + 
              content.slice(operation.position + operation.length);
          }
          break;

        case OperationType.PROPERTY_UPDATE:
          // Property updates are handled by the server and reflected in sync
          break;
      }

      // Update vector clock
      newDocumentState.vectorClock = VectorClockManager.merge(
        newDocumentState.vectorClock,
        operation.vectorClock
      );
      newDocumentState.version += 1;

      return {
        ...prev,
        documentState: newDocumentState
      };
    });
  }, []);

  // Setup socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Handle collaboration state
    const handleCollaborationState = (data: {
      documentState: DocumentState;
      participants: ParticipantInfo[];
      recentOperations: Operation[];
    }) => {
      setState(prev => ({
        ...prev,
        isConnected: true,
        isReady: true,
        documentState: data.documentState,
        participants: data.participants
      }));
    };

    // Handle incoming operations
    const handleIncomingOperation = (message: SyncMessage) => {
      if (message.operation && message.clientId !== clientId.current) {
        // Update vector clock
        vectorClock.current = VectorClockManager.merge(
          vectorClock.current,
          message.vectorClock
        );

        // Apply operation
        applyRemoteOperation(message.operation);
      }
    };

    // Handle operation acknowledgment
    const handleOperationAck = (data: { operationId: string; transformedOperation?: Operation }) => {
      // Remove from pending operations
      operationQueue.current = operationQueue.current.filter(op => op.id !== data.operationId);
      setState(prev => ({
        ...prev,
        pendingOperations: prev.pendingOperations.filter(op => op.id !== data.operationId)
      }));
    };

    // Handle participant joined
    const handleParticipantJoined = (participant: ParticipantInfo) => {
      setState(prev => ({
        ...prev,
        participants: [...prev.participants.filter(p => p.clientId !== participant.clientId), participant]
      }));
    };

    // Handle participant left
    const handleParticipantLeft = (participant: ParticipantInfo) => {
      setState(prev => ({
        ...prev,
        participants: prev.participants.filter(p => p.clientId !== participant.clientId)
      }));
    };

    // Handle sync response
    const handleSyncResponse = (data: {
      documentState: DocumentState;
      operations: Operation[];
      participants: ParticipantInfo[];
    }) => {
      setState(prev => ({
        ...prev,
        documentState: data.documentState,
        participants: data.participants
      }));
    };

    // Handle force sync
    const handleForceSync = (data: {
      documentState: DocumentState;
      operations: Operation[];
    }) => {
      setState(prev => ({
        ...prev,
        documentState: data.documentState,
        pendingOperations: [] // Clear pending operations on force sync
      }));
      operationQueue.current = [];
    };

    // Handle errors
    const handleCollaborationError = (data: { message: string }) => {
      console.error('Collaboration error:', data.message);
      setState(prev => ({
        ...prev,
        isReady: false
      }));
    };

    const handleOperationError = (data: { operationId: string; message: string }) => {
      console.error('Operation error:', data.message);
      // Remove failed operation from queue
      operationQueue.current = operationQueue.current.filter(op => op.id !== data.operationId);
      setState(prev => ({
        ...prev,
        pendingOperations: prev.pendingOperations.filter(op => op.id !== data.operationId)
      }));
    };

    // Register event listeners
    socket.on('collaboration_state', handleCollaborationState);
    socket.on('collaborative_operation', handleIncomingOperation);
    socket.on('operation_ack', handleOperationAck);
    socket.on('participant_joined', handleParticipantJoined);
    socket.on('participant_left', handleParticipantLeft);
    socket.on('sync_response', handleSyncResponse);
    socket.on('force_sync', handleForceSync);
    socket.on('collaboration_error', handleCollaborationError);
    socket.on('operation_error', handleOperationError);

    return () => {
      socket.off('collaboration_state', handleCollaborationState);
      socket.off('collaborative_operation', handleIncomingOperation);
      socket.off('operation_ack', handleOperationAck);
      socket.off('participant_joined', handleParticipantJoined);
      socket.off('participant_left', handleParticipantLeft);
      socket.off('sync_response', handleSyncResponse);
      socket.off('force_sync', handleForceSync);
      socket.off('collaboration_error', handleCollaborationError);
      socket.off('operation_error', handleOperationError);
    };
  }, [socket, applyRemoteOperation]);

  // Auto-join collaboration when socket and sparkId are available
  useEffect(() => {
    if (socket && sparkId && !state.isConnected) {
      joinCollaboration();
    }

    return () => {
      if (socket && sparkId && state.isConnected) {
        leaveCollaboration();
      }
    };
  }, [socket, sparkId, state.isConnected, joinCollaboration, leaveCollaboration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (state.isConnected) {
        leaveCollaboration();
      }
    };
  }, [state.isConnected, leaveCollaboration]);

  return {
    // State
    isConnected: state.isConnected,
    isReady: state.isReady,
    participants: state.participants,
    documentState: state.documentState,
    pendingOperations: state.pendingOperations,
    hasPendingOperations: state.pendingOperations.length > 0,
    
    // Actions
    joinCollaboration,
    leaveCollaboration,
    insertText,
    deleteText,
    updateProperty,
    requestSync,
    
    // Utilities
    getParticipantCount: () => state.participants.length,
    isUserOnline: (userId: string) => state.participants.some(p => p.userId === userId),
    getCurrentContent: () => state.documentState?.content || '',
    getDocumentVersion: () => state.documentState?.version || 0
  };
}