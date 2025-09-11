import { db } from '@/lib/db'
import { Server } from 'socket.io'
import { ImportValidationData, ImportOptions, ValidationError } from '@/lib/validation/import-export'
import { Spark, Todo, SparkConnection, Prisma } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'

export interface ProgressUpdate {
  operationId: string
  phase: 'validation' | 'processing' | 'database' | 'cleanup' | 'complete' | 'error'
  progress: number
  total: number
  message: string
  details?: any
  errors?: ValidationError[]
}

export interface BulkOperationResult {
  success: boolean
  operationId: string
  imported?: {
    sparks: number
    todos: number
    connections: number
  }
  exported?: {
    sparks: number
    todos: number
    connections: number
  }
  errors?: ValidationError[]
  warnings?: string[]
  duration: number
}

export class BulkOperationsService {
  private io: Server | null = null
  private activeOperations = new Map<string, boolean>()

  constructor(io?: Server) {
    this.io = io || null
  }

  setSocketIO(io: Server) {
    this.io = io
  }

  private emitProgress(socketId: string | null, progress: ProgressUpdate) {
    if (this.io && socketId) {
      this.io.to(socketId).emit('bulk_operation_progress', progress)
    }
  }

  async importData(
    userId: string,
    data: ImportValidationData,
    options: ImportOptions,
    socketId?: string,
    operationId?: string
  ): Promise<BulkOperationResult> {
    const startTime = Date.now()
    const opId = operationId || uuidv4()
    
    this.activeOperations.set(opId, true)

    try {
      this.emitProgress(socketId || null, {
        operationId: opId,
        phase: 'validation',
        progress: 0,
        total: 100,
        message: 'Starting import validation...'
      })

      // Phase 1: Data validation and preprocessing
      const validatedData = await this.validateAndPreprocessData(data, options, socketId, opId)
      
      this.emitProgress(socketId || null, {
        operationId: opId,
        phase: 'processing',
        progress: 20,
        total: 100,
        message: 'Processing import data...'
      })

      // Phase 2: Import sparks
      const importedSparks = await this.importSparks(userId, validatedData.sparks, options, socketId, opId)
      
      this.emitProgress(socketId || null, {
        operationId: opId,
        phase: 'processing',
        progress: 60,
        total: 100,
        message: 'Importing todos...'
      })

      // Phase 3: Import todos
      const importedTodos = await this.importTodos(importedSparks, validatedData.sparks, options, socketId, opId)
      
      this.emitProgress(socketId || null, {
        operationId: opId,
        phase: 'processing',
        progress: 80,
        total: 100,
        message: 'Creating connections...'
      })

      // Phase 4: Import connections
      const importedConnections = await this.importConnections(
        importedSparks,
        validatedData.connections || [],
        options,
        socketId,
        opId
      )

      this.emitProgress(socketId || null, {
        operationId: opId,
        phase: 'cleanup',
        progress: 95,
        total: 100,
        message: 'Finalizing import...'
      })

      // Phase 5: Update user preferences if included
      if (validatedData.userPreferences && Object.keys(validatedData.userPreferences).length > 0) {
        await this.updateUserPreferences(userId, validatedData.userPreferences)
      }

      this.emitProgress(socketId || null, {
        operationId: opId,
        phase: 'complete',
        progress: 100,
        total: 100,
        message: 'Import completed successfully!'
      })

      return {
        success: true,
        operationId: opId,
        imported: {
          sparks: importedSparks.length,
          todos: importedTodos,
          connections: importedConnections
        },
        duration: Date.now() - startTime
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      this.emitProgress(socketId || null, {
        operationId: opId,
        phase: 'error',
        progress: 0,
        total: 100,
        message: `Import failed: ${errorMessage}`,
        errors: [{
          path: [],
          message: errorMessage,
          code: 'import_error'
        }]
      })

      return {
        success: false,
        operationId: opId,
        errors: [{
          path: [],
          message: errorMessage,
          code: 'import_error'
        }],
        duration: Date.now() - startTime
      }
    } finally {
      this.activeOperations.delete(opId)
    }
  }

  private async validateAndPreprocessData(
    data: ImportValidationData,
    options: ImportOptions,
    socketId: string | null,
    operationId: string
  ): Promise<ImportValidationData> {
    // Deep validation of spark IDs if preserveIds is true
    if (options.preserveIds) {
      const existingIds = await db.spark.findMany({
        where: {
          id: { in: data.sparks.map(s => s.id).filter(Boolean) as string[] }
        },
        select: { id: true }
      })

      if (existingIds.length > 0 && !options.updateExisting) {
        throw new Error(`Conflicting IDs found: ${existingIds.map(s => s.id).join(', ')}. Use updateExisting option to resolve conflicts.`)
      }
    }

    // Validate references in connections
    if (data.connections) {
      const sparkIds = new Set(data.sparks.map(s => s.id).filter(Boolean))
      const invalidConnections = data.connections.filter(
        conn => !sparkIds.has(conn.sparkId1) || !sparkIds.has(conn.sparkId2)
      )

      if (invalidConnections.length > 0 && !options.skipInvalid) {
        throw new Error(`Invalid spark references in connections: ${invalidConnections.length} connections reference non-existent sparks.`)
      }

      // Filter out invalid connections if skipInvalid is true
      if (options.skipInvalid) {
        data.connections = data.connections.filter(
          conn => sparkIds.has(conn.sparkId1) && sparkIds.has(conn.sparkId2)
        )
      }
    }

    return data
  }

  private async importSparks(
    userId: string,
    sparksData: ImportValidationData['sparks'],
    options: ImportOptions,
    socketId: string | null,
    operationId: string
  ): Promise<Spark[]> {
    const imported: Spark[] = []
    const batchSize = 50
    const total = sparksData.length

    for (let i = 0; i < sparksData.length; i += batchSize) {
      const batch = sparksData.slice(i, i + batchSize)
      
      this.emitProgress(socketId, {
        operationId,
        phase: 'database',
        progress: Math.round((i / total) * 40) + 20,
        total: 100,
        message: `Importing sparks: ${i + 1}-${Math.min(i + batchSize, total)} of ${total}`
      })

      const sparkCreateData = batch.map(sparkData => {
        const sparkId = options.preserveIds && sparkData.id ? sparkData.id : uuidv4()
        
        return {
          id: sparkId,
          userId,
          title: sparkData.title,
          description: sparkData.description || null,
          content: sparkData.content || null,
          status: sparkData.status || 'SEEDLING' as const,
          level: sparkData.level || 1,
          xp: sparkData.xp || 0,
          positionX: sparkData.positionX || null,
          positionY: sparkData.positionY || null,
          color: sparkData.color || '#10b981',
          tags: sparkData.tags ? JSON.stringify(Array.isArray(sparkData.tags) ? sparkData.tags : [sparkData.tags]) : null
        }
      })

      if (options.updateExisting) {
        // Use upsert for update existing option
        for (const sparkData of sparkCreateData) {
          try {
            const spark = await db.spark.upsert({
              where: { id: sparkData.id },
              update: sparkData,
              create: sparkData
            })
            imported.push(spark)
          } catch (error) {
            if (!options.skipInvalid) {
              throw error
            }
            console.warn(`Skipped invalid spark: ${sparkData.title}`, error)
          }
        }
      } else {
        // Use createMany for bulk insert
        try {
          await db.spark.createMany({
            data: sparkCreateData,
            skipDuplicates: options.skipInvalid
          })

          // Fetch created sparks for further processing
          const createdSparks = await db.spark.findMany({
            where: {
              id: { in: sparkCreateData.map(s => s.id) }
            }
          })
          
          imported.push(...createdSparks)
        } catch (error) {
          if (!options.skipInvalid) {
            throw error
          }
          console.warn(`Skipped batch due to error:`, error)
        }
      }
    }

    return imported
  }

  private async importTodos(
    importedSparks: Spark[],
    originalSparksData: ImportValidationData['sparks'],
    options: ImportOptions,
    socketId: string | null,
    operationId: string
  ): Promise<number> {
    const sparkIdMap = new Map(importedSparks.map(spark => {
      // Find original spark data to get the mapping
      const originalId = originalSparksData.find(original => 
        original.title === spark.title && original.description === spark.description
      )?.id
      return [originalId || spark.id, spark.id]
    }))

    let importedCount = 0
    const batchSize = 100

    for (const originalSpark of originalSparksData) {
      if (!originalSpark.todos || originalSpark.todos.length === 0) continue

      const sparkId = sparkIdMap.get(originalSpark.id || originalSpark.title) || 
                     importedSparks.find(s => s.title === originalSpark.title)?.id

      if (!sparkId) continue

      const todosData = originalSpark.todos
      
      for (let i = 0; i < todosData.length; i += batchSize) {
        const batch = todosData.slice(i, i + batchSize)
        
        const todoCreateData = batch.map(todoData => ({
          id: options.preserveIds && todoData.id ? todoData.id : uuidv4(),
          sparkId,
          title: todoData.title,
          description: todoData.description || null,
          completed: todoData.completed || false,
          type: todoData.type || 'GENERAL' as const,
          priority: todoData.priority || 'MEDIUM' as const,
          positionX: todoData.positionX || null,
          positionY: todoData.positionY || null
        }))

        try {
          if (options.updateExisting) {
            for (const todoData of todoCreateData) {
              await db.todo.upsert({
                where: { id: todoData.id },
                update: todoData,
                create: todoData
              })
              importedCount++
            }
          } else {
            await db.todo.createMany({
              data: todoCreateData,
              skipDuplicates: options.skipInvalid
            })
            importedCount += todoCreateData.length
          }
        } catch (error) {
          if (!options.skipInvalid) {
            throw error
          }
          console.warn(`Skipped todos batch:`, error)
        }
      }
    }

    return importedCount
  }

  private async importConnections(
    importedSparks: Spark[],
    connectionsData: ImportValidationData['connections'],
    options: ImportOptions,
    socketId: string | null,
    operationId: string
  ): Promise<number> {
    if (!connectionsData || connectionsData.length === 0) return 0

    const sparkIdMap = new Map(importedSparks.map(spark => [spark.id, spark.id]))
    let importedCount = 0
    const batchSize = 50

    for (let i = 0; i < connectionsData.length; i += batchSize) {
      const batch = connectionsData.slice(i, i + batchSize)
      
      const connectionCreateData = batch
        .filter(conn => sparkIdMap.has(conn.sparkId1) && sparkIdMap.has(conn.sparkId2))
        .map(connData => ({
          id: uuidv4(),
          sparkId1: connData.sparkId1,
          sparkId2: connData.sparkId2,
          type: connData.type || 'RELATED_TO' as const,
          metadata: connData.metadata || null
        }))

      if (connectionCreateData.length === 0) continue

      try {
        await db.sparkConnection.createMany({
          data: connectionCreateData,
          skipDuplicates: true
        })
        importedCount += connectionCreateData.length
      } catch (error) {
        if (!options.skipInvalid) {
          throw error
        }
        console.warn(`Skipped connections batch:`, error)
      }
    }

    return importedCount
  }

  private async updateUserPreferences(userId: string, preferences: any) {
    await db.userPreferences.upsert({
      where: { userId },
      update: preferences,
      create: {
        userId,
        ...preferences
      }
    })
  }

  async exportData(
    userId: string,
    options: { sparkIds?: string[], includeAttachments?: boolean },
    socketId?: string,
    operationId?: string
  ): Promise<BulkOperationResult & { data?: any }> {
    const startTime = Date.now()
    const opId = operationId || uuidv4()
    
    this.activeOperations.set(opId, true)

    try {
      this.emitProgress(socketId || null, {
        operationId: opId,
        phase: 'processing',
        progress: 10,
        total: 100,
        message: 'Fetching sparks data...'
      })

      // Fetch sparks with related data
      const sparks = await db.spark.findMany({
        where: {
          userId,
          ...(options.sparkIds ? { id: { in: options.sparkIds } } : {})
        },
        include: {
          todos: true,
          ...(options.includeAttachments ? { attachments: true } : {})
        },
        orderBy: { createdAt: 'asc' }
      })

      this.emitProgress(socketId || null, {
        operationId: opId,
        phase: 'processing',
        progress: 40,
        total: 100,
        message: 'Fetching connections...'
      })

      // Fetch connections
      const sparkIds = sparks.map(s => s.id)
      const connections = await db.sparkConnection.findMany({
        where: {
          OR: [
            { sparkId1: { in: sparkIds } },
            { sparkId2: { in: sparkIds } }
          ]
        }
      })

      this.emitProgress(socketId || null, {
        operationId: opId,
        phase: 'processing',
        progress: 70,
        total: 100,
        message: 'Fetching user data...'
      })

      // Fetch user and preferences
      const [user, userPreferences] = await Promise.all([
        db.user.findUnique({ where: { id: userId } }),
        db.userPreferences.findUnique({ where: { userId } })
      ])

      this.emitProgress(socketId || null, {
        operationId: opId,
        phase: 'processing',
        progress: 90,
        total: 100,
        message: 'Preparing export data...'
      })

      const exportData = {
        export: {
          version: "1.0.0",
          timestamp: new Date().toISOString(),
          type: "spark_project_export"
        },
        user: user ? {
          id: user.id,
          name: user.name,
          email: user.email,
          totalXP: user.totalXP,
          level: user.level,
          currentStreak: user.currentStreak
        } : null,
        userPreferences,
        sparks: sparks.map(spark => ({
          ...spark,
          tags: spark.tags ? JSON.parse(spark.tags) : []
        })),
        connections,
        statistics: {
          totalSparks: sparks.length,
          totalConnections: connections.length,
          totalTodos: sparks.reduce((sum, spark) => sum + spark.todos.length, 0),
          completedTodos: sparks.reduce((sum, spark) => 
            sum + spark.todos.filter(todo => todo.completed).length, 0)
        }
      }

      this.emitProgress(socketId || null, {
        operationId: opId,
        phase: 'complete',
        progress: 100,
        total: 100,
        message: 'Export completed successfully!'
      })

      return {
        success: true,
        operationId: opId,
        exported: {
          sparks: sparks.length,
          todos: sparks.reduce((sum, spark) => sum + spark.todos.length, 0),
          connections: connections.length
        },
        data: exportData,
        duration: Date.now() - startTime
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      this.emitProgress(socketId || null, {
        operationId: opId,
        phase: 'error',
        progress: 0,
        total: 100,
        message: `Export failed: ${errorMessage}`,
        errors: [{
          path: [],
          message: errorMessage,
          code: 'export_error'
        }]
      })

      return {
        success: false,
        operationId: opId,
        errors: [{
          path: [],
          message: errorMessage,
          code: 'export_error'
        }],
        duration: Date.now() - startTime
      }
    } finally {
      this.activeOperations.delete(opId)
    }
  }

  isOperationActive(operationId: string): boolean {
    return this.activeOperations.has(operationId)
  }

  cancelOperation(operationId: string): boolean {
    if (this.activeOperations.has(operationId)) {
      this.activeOperations.delete(operationId)
      return true
    }
    return false
  }
}