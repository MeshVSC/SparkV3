import { db } from "@/lib/db"
import { ConnectionChangeType, ConnectionType } from "@prisma/client"
import { SparkConnection } from "@/types/spark"

export interface ConnectionHistoryEntry {
  id: string
  connectionId: string | null
  sparkId1: string
  sparkId2: string
  changeType: ConnectionChangeType
  userId: string
  username: string
  beforeState: any | null
  afterState: any | null
  metadata: any | null
  reason: string | null
  createdAt: Date
}

export interface CreateConnectionHistoryData {
  connectionId?: string
  sparkId1: string
  sparkId2: string
  changeType: ConnectionChangeType
  userId: string
  username: string
  beforeState?: any
  afterState?: any
  metadata?: any
  reason?: string
}

export interface RollbackResult {
  success: boolean
  error?: string
  restoredConnection?: SparkConnection
  deletedConnectionId?: string
}

export class ConnectionHistoryService {
  /**
   * Record a connection change in history
   */
  async recordChange(data: CreateConnectionHistoryData): Promise<ConnectionHistoryEntry> {
    return await db.connectionHistory.create({
      data: {
        connectionId: data.connectionId || null,
        sparkId1: data.sparkId1,
        sparkId2: data.sparkId2,
        changeType: data.changeType,
        userId: data.userId,
        username: data.username,
        beforeState: data.beforeState || null,
        afterState: data.afterState || null,
        metadata: data.metadata || null,
        reason: data.reason || null,
      }
    })
  }

  /**
   * Get connection history for a specific connection
   */
  async getConnectionHistory(
    sparkId1: string, 
    sparkId2: string, 
    options: { limit?: number; offset?: number } = {}
  ): Promise<ConnectionHistoryEntry[]> {
    const { limit = 50, offset = 0 } = options

    return await db.connectionHistory.findMany({
      where: {
        OR: [
          { sparkId1, sparkId2 },
          { sparkId1: sparkId2, sparkId2: sparkId1 }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })
  }

  /**
   * Get all connection history for a user
   */
  async getUserConnectionHistory(
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<ConnectionHistoryEntry[]> {
    const { limit = 100, offset = 0 } = options

    return await db.connectionHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })
  }

  /**
   * Get history for all connections involving specific sparks
   */
  async getSparkConnectionHistory(
    sparkIds: string[],
    options: { limit?: number; offset?: number } = {}
  ): Promise<ConnectionHistoryEntry[]> {
    const { limit = 100, offset = 0 } = options

    return await db.connectionHistory.findMany({
      where: {
        OR: [
          { sparkId1: { in: sparkIds } },
          { sparkId2: { in: sparkIds } }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })
  }

  /**
   * Rollback a connection to a previous state
   */
  async rollbackToHistoryEntry(historyId: string, userId: string, username: string): Promise<RollbackResult> {
    try {
      // Get the history entry
      const historyEntry = await db.connectionHistory.findUnique({
        where: { id: historyId }
      })

      if (!historyEntry) {
        return { success: false, error: "History entry not found" }
      }

      const { sparkId1, sparkId2, changeType, beforeState } = historyEntry

      // Find current connection state
      const currentConnection = await db.sparkConnection.findFirst({
        where: {
          OR: [
            { sparkId1, sparkId2 },
            { sparkId1: sparkId2, sparkId2: sparkId1 }
          ]
        }
      })

      let result: RollbackResult

      if (changeType === ConnectionChangeType.CREATED) {
        // If the original change was creation, rollback means deletion
        if (currentConnection) {
          await db.sparkConnection.delete({
            where: { id: currentConnection.id }
          })

          // Record the rollback action
          await this.recordChange({
            connectionId: currentConnection.id,
            sparkId1,
            sparkId2,
            changeType: ConnectionChangeType.DELETED,
            userId,
            username,
            beforeState: {
              id: currentConnection.id,
              sparkId1: currentConnection.sparkId1,
              sparkId2: currentConnection.sparkId2,
              type: currentConnection.type,
              metadata: currentConnection.metadata,
              createdAt: currentConnection.createdAt
            },
            afterState: null,
            metadata: { 
              rolledBackFromHistory: historyId, 
              originalChangeType: changeType 
            },
            reason: `Rolled back creation from history entry ${historyId}`
          })

          result = { 
            success: true, 
            deletedConnectionId: currentConnection.id 
          }
        } else {
          result = { success: false, error: "Connection no longer exists" }
        }

      } else if (changeType === ConnectionChangeType.DELETED) {
        // If the original change was deletion, rollback means recreation
        if (!currentConnection && beforeState) {
          const restoredConnection = await db.sparkConnection.create({
            data: {
              sparkId1: beforeState.sparkId1,
              sparkId2: beforeState.sparkId2,
              type: beforeState.type || ConnectionType.RELATED_TO,
              metadata: beforeState.metadata
            }
          })

          // Record the rollback action
          await this.recordChange({
            connectionId: restoredConnection.id,
            sparkId1,
            sparkId2,
            changeType: ConnectionChangeType.CREATED,
            userId,
            username,
            beforeState: null,
            afterState: {
              id: restoredConnection.id,
              sparkId1: restoredConnection.sparkId1,
              sparkId2: restoredConnection.sparkId2,
              type: restoredConnection.type,
              metadata: restoredConnection.metadata,
              createdAt: restoredConnection.createdAt
            },
            metadata: { 
              rolledBackFromHistory: historyId, 
              originalChangeType: changeType 
            },
            reason: `Rolled back deletion from history entry ${historyId}`
          })

          result = { 
            success: true, 
            restoredConnection: {
              id: restoredConnection.id,
              sparkId1: restoredConnection.sparkId1,
              sparkId2: restoredConnection.sparkId2,
              type: restoredConnection.type as any,
              metadata: restoredConnection.metadata as any,
              createdAt: restoredConnection.createdAt
            }
          }
        } else {
          result = { success: false, error: "Connection already exists or invalid previous state" }
        }

      } else if (changeType === ConnectionChangeType.MODIFIED) {
        // If the original change was modification, rollback to before state
        if (currentConnection && beforeState) {
          const updatedConnection = await db.sparkConnection.update({
            where: { id: currentConnection.id },
            data: {
              type: beforeState.type || ConnectionType.RELATED_TO,
              metadata: beforeState.metadata
            }
          })

          // Record the rollback action
          await this.recordChange({
            connectionId: currentConnection.id,
            sparkId1,
            sparkId2,
            changeType: ConnectionChangeType.MODIFIED,
            userId,
            username,
            beforeState: {
              id: currentConnection.id,
              sparkId1: currentConnection.sparkId1,
              sparkId2: currentConnection.sparkId2,
              type: currentConnection.type,
              metadata: currentConnection.metadata,
              createdAt: currentConnection.createdAt
            },
            afterState: {
              id: updatedConnection.id,
              sparkId1: updatedConnection.sparkId1,
              sparkId2: updatedConnection.sparkId2,
              type: updatedConnection.type,
              metadata: updatedConnection.metadata,
              createdAt: updatedConnection.createdAt
            },
            metadata: { 
              rolledBackFromHistory: historyId, 
              originalChangeType: changeType 
            },
            reason: `Rolled back modification from history entry ${historyId}`
          })

          result = { 
            success: true, 
            restoredConnection: {
              id: updatedConnection.id,
              sparkId1: updatedConnection.sparkId1,
              sparkId2: updatedConnection.sparkId2,
              type: updatedConnection.type as any,
              metadata: updatedConnection.metadata as any,
              createdAt: updatedConnection.createdAt
            }
          }
        } else {
          result = { success: false, error: "Connection not found or invalid previous state" }
        }
      } else {
        result = { success: false, error: "Unknown change type" }
      }

      return result

    } catch (error) {
      console.error("Error during rollback:", error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error during rollback" 
      }
    }
  }

  /**
   * Get connection history statistics
   */
  async getHistoryStats(userId?: string): Promise<{
    totalChanges: number
    createdCount: number
    modifiedCount: number
    deletedCount: number
    recentActivity: ConnectionHistoryEntry[]
  }> {
    const where = userId ? { userId } : {}

    const [totalChanges, createdCount, modifiedCount, deletedCount, recentActivity] = await Promise.all([
      db.connectionHistory.count({ where }),
      db.connectionHistory.count({ where: { ...where, changeType: ConnectionChangeType.CREATED } }),
      db.connectionHistory.count({ where: { ...where, changeType: ConnectionChangeType.MODIFIED } }),
      db.connectionHistory.count({ where: { ...where, changeType: ConnectionChangeType.DELETED } }),
      db.connectionHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ])

    return {
      totalChanges,
      createdCount,
      modifiedCount,
      deletedCount,
      recentActivity
    }
  }

  /**
   * Clean up old history entries (for maintenance)
   */
  async cleanupOldHistory(olderThanDays: number = 365): Promise<{ deletedCount: number }> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    const result = await db.connectionHistory.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    })

    return { deletedCount: result.count }
  }
}

// Singleton instance
export const connectionHistoryService = new ConnectionHistoryService()