import { Server, Socket } from 'socket.io'
import { BulkOperationsService } from '@/lib/services/bulk-operations'

export interface BulkOperationSocketData {
  userId: string
  operationId: string
  type: 'import' | 'export'
}

export function setupBulkOperationsSocket(io: Server, bulkOpsService: BulkOperationsService) {
  // Set the socket IO instance for progress updates
  bulkOpsService.setSocketIO(io)

  io.on('connection', (socket: Socket) => {
    console.log('Client connected for bulk operations:', socket.id)

    // Join room for bulk operation updates
    socket.on('join_bulk_operation', (data: { operationId: string }) => {
      const { operationId } = data
      socket.join(`bulk_operation_${operationId}`)
      console.log(`Client ${socket.id} joined bulk operation room: ${operationId}`)
    })

    // Leave bulk operation room
    socket.on('leave_bulk_operation', (data: { operationId: string }) => {
      const { operationId } = data
      socket.leave(`bulk_operation_${operationId}`)
      console.log(`Client ${socket.id} left bulk operation room: ${operationId}`)
    })

    // Check operation status
    socket.on('check_operation_status', (data: { operationId: string }) => {
      const { operationId } = data
      const isActive = bulkOpsService.isOperationActive(operationId)
      
      socket.emit('operation_status', {
        operationId,
        active: isActive,
        timestamp: new Date().toISOString()
      })
    })

    // Cancel operation
    socket.on('cancel_operation', (data: { operationId: string }) => {
      const { operationId } = data
      const cancelled = bulkOpsService.cancelOperation(operationId)
      
      socket.emit('operation_cancelled', {
        operationId,
        success: cancelled,
        timestamp: new Date().toISOString()
      })

      if (cancelled) {
        // Notify all clients in the operation room
        io.to(`bulk_operation_${operationId}`).emit('bulk_operation_progress', {
          operationId,
          phase: 'error',
          progress: 0,
          total: 100,
          message: 'Operation cancelled by user',
          errors: [{
            path: [],
            message: 'Operation was cancelled',
            code: 'operation_cancelled'
          }]
        })
      }
    })

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected from bulk operations:', socket.id)
    })
  })

  // Helper function to emit progress to specific operation room
  return {
    emitProgress: (operationId: string, progress: any) => {
      io.to(`bulk_operation_${operationId}`).emit('bulk_operation_progress', progress)
    },
    
    emitError: (operationId: string, error: any) => {
      io.to(`bulk_operation_${operationId}`).emit('bulk_operation_error', {
        operationId,
        error,
        timestamp: new Date().toISOString()
      })
    },
    
    emitComplete: (operationId: string, result: any) => {
      io.to(`bulk_operation_${operationId}`).emit('bulk_operation_complete', {
        operationId,
        result,
        timestamp: new Date().toISOString()
      })
    }
  }
}