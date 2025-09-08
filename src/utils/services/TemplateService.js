import { db } from "@/lib/db"

export class TemplateService {
  /**
   * Serialize current project data into template format
   * @param {Object} params - Parameters for serialization
   * @param {Array} params.sparks - Current sparks data
   * @param {Array} params.connections - Current spark connections
   * @param {Object} params.userPreferences - User preferences
   * @param {Object} params.metadata - Additional metadata
   * @returns {Object} - Serialized template data
   */
  static async serializeProjectData({ sparks, connections = [], userPreferences = {}, metadata = {} }) {
    try {
      if (!sparks || !Array.isArray(sparks)) {
        throw new Error('Invalid sparks data: array is required')
      }

      // Calculate project statistics
      const statistics = {
        totalSparks: sparks.length,
        totalConnections: connections.length,
        totalTodos: sparks.reduce((sum, spark) => sum + (spark.todos?.length || 0), 0),
        completedTodos: sparks.reduce((sum, spark) => 
          sum + (spark.todos?.filter(todo => todo.completed).length || 0), 0),
        totalXP: sparks.reduce((sum, spark) => sum + (spark.xp || 0), 0),
        sparksByStatus: sparks.reduce((acc, spark) => {
          acc[spark.status] = (acc[spark.status] || 0) + 1
          return acc
        }, {}),
        sparksByLevel: sparks.reduce((acc, spark) => {
          const level = spark.level || 1
          acc[level] = (acc[level] || 0) + 1
          return acc
        }, {}),
        totalAttachments: sparks.reduce((sum, spark) => sum + (spark.attachments?.length || 0), 0)
      }

      const templateData = {
        // Template metadata
        version: "1.0.0",
        createdAt: new Date().toISOString(),
        type: "spark_project_template",
        
        // Project statistics
        statistics,
        
        // User preferences (serialized for template)
        preferences: {
          theme: userPreferences.theme || 'AUTO',
          soundEnabled: userPreferences.soundEnabled ?? true,
          defaultSparkColor: userPreferences.defaultSparkColor || '#10b981',
          viewMode: userPreferences.viewMode || 'CANVAS',
          notifications: {
            email: userPreferences.emailNotifications ?? true,
            push: userPreferences.pushNotifications ?? true,
            inApp: userPreferences.inAppNotifications ?? true
          }
        },
        
        // Sparks data with full structure
        sparks: sparks.map(spark => ({
          // Core spark data (without user-specific IDs)
          title: spark.title,
          description: spark.description,
          content: spark.content,
          status: spark.status || 'SEEDLING',
          level: spark.level || 1,
          xp: spark.xp || 0,
          color: spark.color || '#10b981',
          tags: this._normalizeTags(spark.tags),
          
          // Position data for canvas layout
          position: {
            x: spark.positionX || 0,
            y: spark.positionY || 0
          },
          
          // Original timestamps (for reference)
          originalCreatedAt: spark.createdAt,
          originalUpdatedAt: spark.updatedAt,
          
          // Todos data
          todos: (spark.todos || []).map(todo => ({
            title: todo.title,
            description: todo.description,
            completed: todo.completed || false,
            type: todo.type || 'GENERAL',
            priority: todo.priority || 'MEDIUM',
            position: {
              x: todo.positionX || 0,
              y: todo.positionY || 0
            },
            originalCreatedAt: todo.createdAt,
            originalCompletedAt: todo.completedAt
          })),
          
          // Attachments metadata (URLs might need updating on restore)
          attachments: (spark.attachments || []).map(attachment => ({
            filename: attachment.filename,
            type: attachment.type,
            size: attachment.size,
            // Note: URL is stored but may need re-processing on restore
            url: attachment.url,
            originalCreatedAt: attachment.createdAt
          }))
        })),
        
        // Connection relationships
        connections: connections.map((connection, index) => ({
          // Use indices to reference sparks instead of IDs
          spark1Index: sparks.findIndex(s => s.id === connection.sparkId1),
          spark2Index: sparks.findIndex(s => s.id === connection.sparkId2),
          type: connection.type || 'RELATED_TO',
          metadata: connection.metadata,
          originalCreatedAt: connection.createdAt
        })).filter(conn => conn.spark1Index !== -1 && conn.spark2Index !== -1),
        
        // Additional metadata
        metadata: {
          originalSparkCount: sparks.length,
          originalConnectionCount: connections.length,
          templateCreatedBy: metadata.userId,
          sourceProject: metadata.projectName || 'Untitled Project',
          ...metadata
        }
      }
      
      // Validate template data structure
      this._validateTemplateData(templateData)
      
      return templateData
    } catch (error) {
      console.error('Error serializing project data:', error)
      throw new Error(`Failed to serialize project data: ${error.message}`)
    }
  }

  /**
   * Deserialize template data into project structure
   * @param {Object} templateData - The template data to deserialize
   * @param {Object} params - Parameters for deserialization
   * @param {string} params.userId - Target user ID for the new project
   * @param {Object} params.overrides - Optional overrides for template data
   * @returns {Object} - Deserialized project data ready for creation
   */
  static async deserializeTemplateData(templateData, { userId, overrides = {} }) {
    try {
      if (!templateData || typeof templateData !== 'object') {
        throw new Error('Invalid template data: object is required')
      }
      
      if (!userId) {
        throw new Error('User ID is required for template deserialization')
      }
      
      const { sparks = [], connections = [], preferences = {}, metadata = {} } = templateData
      
      // Generate new IDs for sparks to avoid conflicts
      const sparkIdMapping = new Map()
      
      // Deserialize sparks with new IDs and user association
      const deserializedSparks = sparks.map((sparkTemplate, index) => {
        const newSparkId = this._generateId()
        sparkIdMapping.set(index, newSparkId)
        
        return {
          id: newSparkId,
          userId: userId,
          title: sparkTemplate.title || 'Untitled Spark',
          description: sparkTemplate.description || '',
          content: sparkTemplate.content || '',
          status: sparkTemplate.status || 'SEEDLING',
          level: sparkTemplate.level || 1,
          xp: sparkTemplate.xp || 0,
          color: sparkTemplate.color || preferences.defaultSparkColor || '#10b981',
          tags: this._serializeTags(sparkTemplate.tags || []),
          positionX: sparkTemplate.position?.x || Math.random() * 800,
          positionY: sparkTemplate.position?.y || Math.random() * 600,
          
          // Todos with new IDs
          todos: (sparkTemplate.todos || []).map(todoTemplate => ({
            id: this._generateId(),
            title: todoTemplate.title || 'Untitled Task',
            description: todoTemplate.description || '',
            completed: todoTemplate.completed || false,
            type: todoTemplate.type || 'GENERAL',
            priority: todoTemplate.priority || 'MEDIUM',
            positionX: todoTemplate.position?.x,
            positionY: todoTemplate.position?.y
          })),
          
          // Attachments (may need URL processing)
          attachments: (sparkTemplate.attachments || []).map(attachmentTemplate => ({
            id: this._generateId(),
            filename: attachmentTemplate.filename,
            type: attachmentTemplate.type,
            size: attachmentTemplate.size,
            url: attachmentTemplate.url // Note: May need re-processing
          }))
        }
      })
      
      // Deserialize connections using new spark IDs
      const deserializedConnections = connections
        .filter(connTemplate => 
          sparkIdMapping.has(connTemplate.spark1Index) && 
          sparkIdMapping.has(connTemplate.spark2Index)
        )
        .map(connTemplate => ({
          id: this._generateId(),
          sparkId1: sparkIdMapping.get(connTemplate.spark1Index),
          sparkId2: sparkIdMapping.get(connTemplate.spark2Index),
          type: connTemplate.type || 'RELATED_TO',
          metadata: connTemplate.metadata
        }))
      
      // Merge template preferences with user preferences
      const deserializedPreferences = {
        theme: preferences.theme || 'AUTO',
        soundEnabled: preferences.soundEnabled ?? true,
        defaultSparkColor: preferences.defaultSparkColor || '#10b981',
        viewMode: preferences.viewMode || 'CANVAS',
        emailNotifications: preferences.notifications?.email ?? true,
        pushNotifications: preferences.notifications?.push ?? true,
        inAppNotifications: preferences.notifications?.inApp ?? true,
        ...overrides.preferences
      }
      
      return {
        sparks: deserializedSparks,
        connections: deserializedConnections,
        preferences: deserializedPreferences,
        metadata: {
          ...metadata,
          deserializedAt: new Date().toISOString(),
          deserializedFor: userId,
          templateVersion: templateData.version || '1.0.0'
        }
      }
    } catch (error) {
      console.error('Error deserializing template data:', error)
      throw new Error(`Failed to deserialize template data: ${error.message}`)
    }
  }

  /**
   * Create sparks and connections from deserialized template data
   * @param {Object} projectData - Deserialized project data
   * @param {string} userId - User ID to create data for
   * @returns {Promise<Object>} - Created project data
   */
  static async createProjectFromTemplate(projectData, userId) {
    try {
      const { sparks, connections, preferences } = projectData
      
      // Create sparks with todos and attachments
      const createdSparks = []
      for (const sparkData of sparks) {
        const { todos, attachments, ...sparkCore } = sparkData
        
        // Create the spark
        const createdSpark = await db.spark.create({
          data: {
            ...sparkCore,
            userId: userId
          }
        })
        
        // Create todos for this spark
        if (todos && todos.length > 0) {
          await db.todo.createMany({
            data: todos.map(todo => ({
              ...todo,
              sparkId: createdSpark.id
            }))
          })
        }
        
        // Create attachments for this spark
        if (attachments && attachments.length > 0) {
          await db.attachment.createMany({
            data: attachments.map(attachment => ({
              ...attachment,
              sparkId: createdSpark.id
            }))
          })
        }
        
        // Fetch complete spark with relations
        const completeSparkData = await db.spark.findUnique({
          where: { id: createdSpark.id },
          include: {
            todos: true,
            attachments: true
          }
        })
        
        createdSparks.push(completeSparkData)
      }
      
      // Create connections between sparks
      const createdConnections = []
      if (connections && connections.length > 0) {
        for (const connectionData of connections) {
          const createdConnection = await db.sparkConnection.create({
            data: connectionData
          })
          createdConnections.push(createdConnection)
        }
      }
      
      // Update user preferences if provided
      if (preferences && Object.keys(preferences).length > 0) {
        await db.userPreferences.upsert({
          where: { userId: userId },
          update: preferences,
          create: {
            userId: userId,
            ...preferences
          }
        })
      }
      
      return {
        sparks: createdSparks,
        connections: createdConnections,
        preferences: preferences
      }
    } catch (error) {
      console.error('Error creating project from template:', error)
      throw new Error(`Failed to create project from template: ${error.message}`)
    }
  }

  /**
   * Normalize tags data for consistent storage
   * @private
   */
  static _normalizeTags(tags) {
    if (!tags) return []
    if (typeof tags === 'string') {
      try {
        return JSON.parse(tags)
      } catch {
        return tags.split(',').map(tag => tag.trim()).filter(Boolean)
      }
    }
    return Array.isArray(tags) ? tags : []
  }

  /**
   * Serialize tags for storage
   * @private
   */
  static _serializeTags(tags) {
    if (!tags || !Array.isArray(tags)) return null
    return tags.length > 0 ? JSON.stringify(tags) : null
  }

  /**
   * Generate a new CUID-like ID
   * @private
   */
  static _generateId() {
    // Simple ID generation - in production, use proper CUID library
    return 'spark_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
  }

  /**
   * Validate template data structure
   * @private
   */
  static _validateTemplateData(templateData) {
    if (!templateData || typeof templateData !== 'object') {
      throw new Error('Template data must be an object')
    }
    
    if (!Array.isArray(templateData.sparks)) {
      throw new Error('Template data must include sparks array')
    }
    
    if (!Array.isArray(templateData.connections)) {
      throw new Error('Template data must include connections array')
    }
    
    if (!templateData.version) {
      throw new Error('Template data must include version')
    }
    
    // Validate spark structure
    templateData.sparks.forEach((spark, index) => {
      if (!spark.title) {
        throw new Error(`Spark at index ${index} must have a title`)
      }
      if (!spark.status) {
        throw new Error(`Spark at index ${index} must have a status`)
      }
    })
    
    // Validate connection indices
    templateData.connections.forEach((connection, index) => {
      if (typeof connection.spark1Index !== 'number' || typeof connection.spark2Index !== 'number') {
        throw new Error(`Connection at index ${index} must have valid spark indices`)
      }
      if (connection.spark1Index >= templateData.sparks.length || connection.spark2Index >= templateData.sparks.length) {
        throw new Error(`Connection at index ${index} references invalid spark index`)
      }
    })
  }
}