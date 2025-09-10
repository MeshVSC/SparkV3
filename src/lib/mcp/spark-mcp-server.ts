import { Spark, Todo, Attachment, SparkStatus, TodoPriority, TodoType, AttachmentType } from "@/types/spark"
import { db } from "@/lib/db"

export class SparkMCPServer {
  private formatSpark(spark: any): Spark {
    return {
      id: spark.id,
      userId: spark.userId,
      title: spark.title,
      description: spark.description,
      content: spark.content,
      status: spark.status as SparkStatus,
      xp: spark.xp,
      level: spark.level,
      positionX: spark.positionX,
      positionY: spark.positionY,
      color: spark.color,
      tags: spark.tags,
      createdAt: new Date(spark.createdAt),
      updatedAt: new Date(spark.updatedAt),
      todos: spark.todos?.map((todo: any) => this.formatTodo(todo)) || [],
      attachments: spark.attachments?.map((att: any) => this.formatAttachment(att)) || [],
      connections: spark.connections || []
    }
  }

  private formatTodo(todo: any): Todo {
    return {
      id: todo.id,
      sparkId: todo.sparkId,
      title: todo.title,
      description: todo.description,
      completed: todo.completed,
      type: todo.type as TodoType,
      priority: todo.priority as TodoPriority,
      positionX: todo.positionX,
      positionY: todo.positionY,
      createdAt: new Date(todo.createdAt),
      completedAt: todo.completedAt ? new Date(todo.completedAt) : undefined
    }
  }

  private formatAttachment(att: any): Attachment {
    return {
      id: att.id,
      sparkId: att.sparkId,
      filename: att.filename,
      url: att.url,
      type: att.type as AttachmentType,
      size: att.size,
      createdAt: new Date(att.createdAt)
    }
  }

  async readSparks(query?: string): Promise<Spark[]> {
    try {
      let sparks
      
      if (query && query.trim()) {
        const searchQuery = query.trim().toLowerCase()
        sparks = await db.spark.findMany({
          where: {
            OR: [
              {
                title: {
                  contains: searchQuery,
                }
              },
              {
                description: {
                  contains: searchQuery,
                }
              },
              {
                content: {
                  contains: searchQuery,
                }
              },
              {
                tags: {
                  contains: searchQuery,
                }
              }
            ]
          },
          include: {
            todos: true,
            attachments: true,
            connections: true
          },
          orderBy: {
            updatedAt: "desc"
          }
        })
      } else {
        sparks = await db.spark.findMany({
          include: {
            todos: true,
            attachments: true,
            connections: true
          },
          orderBy: {
            updatedAt: "desc"
          }
        })
      }

      return sparks.map(spark => this.formatSpark(spark))
    } catch (error) {
      console.error("Error reading sparks:", error)
      throw new Error("Failed to read sparks")
    }
  }

  async createSpark(title: string, description?: string, status?: SparkStatus): Promise<Spark> {
    try {
      // Get or create default user
      let user = await db.user.findUnique({
        where: { email: "default@example.com" }
      })
      
      if (!user) {
        user = await db.user.create({
          data: {
            email: "default@example.com",
            name: "Default User",
            totalXP: 0,
            level: 1
          }
        })
      }

      const spark = await db.spark.create({
        data: {
          userId: user.id,
          title: title.trim(),
          description: description?.trim() || undefined,
          status: status || SparkStatus.SEEDLING,
          xp: 10, // Award XP for creation
          level: 1,
          color: "#10b981",
          positionX: Math.random() * 500,
          positionY: Math.random() * 500
        },
        include: {
          todos: true,
          attachments: true,
          connections: true
        }
      })

      return this.formatSpark(spark)
    } catch (error) {
      console.error("Error creating spark:", error)
      throw new Error("Failed to create spark")
    }
  }

  async updateSpark(id: string, updates: Partial<Spark>): Promise<Spark> {
    try {
      const existingSpark = await db.spark.findUnique({
        where: { id }
      })

      if (!existingSpark) {
        throw new Error("Spark not found")
      }

      const spark = await db.spark.update({
        where: { id },
        data: {
          title: updates.title,
          description: updates.description,
          content: updates.content,
          status: updates.status,
          xp: updates.xp,
          level: updates.level,
          color: updates.color,
          tags: updates.tags,
          positionX: updates.positionX,
          positionY: updates.positionY
        },
        include: {
          todos: true,
          attachments: true,
          connections: true
        }
      })

      return this.formatSpark(spark)
    } catch (error) {
      console.error("Error updating spark:", error)
      throw new Error("Failed to update spark")
    }
  }

  async addTodo(sparkId: string, title: string, description?: string, priority?: TodoPriority): Promise<Todo> {
    try {
      const existingSpark = await db.spark.findUnique({
        where: { id: sparkId }
      })

      if (!existingSpark) {
        throw new Error("Spark not found")
      }

      const todo = await db.todo.create({
        data: {
          sparkId,
          title: title.trim(),
          description: description?.trim() || undefined,
          type: TodoType.GENERAL,
          priority: priority || TodoPriority.MEDIUM,
          completed: false
        }
      })

      // Award XP for adding todo
      await db.spark.update({
        where: { id: sparkId },
        data: {
          xp: existingSpark.xp + 5
        }
      })

      return this.formatTodo(todo)
    } catch (error) {
      console.error("Error adding todo:", error)
      throw new Error("Failed to add todo")
    }
  }

  async completeTodo(sparkId: string, todoId: string): Promise<Todo> {
    try {
      const todo = await db.todo.findFirst({
        where: {
          id: todoId,
          sparkId: sparkId
        }
      })

      if (!todo) {
        throw new Error("Todo not found")
      }

      const updatedTodo = await db.todo.update({
        where: { id: todoId },
        data: {
          completed: true,
          completedAt: new Date()
        }
      })

      // Award XP for completing todo
      const spark = await db.spark.findUnique({
        where: { id: sparkId }
      })

      if (spark) {
        await db.spark.update({
          where: { id: sparkId },
          data: {
            xp: spark.xp + 20
          }
        })
      }

      return this.formatTodo(updatedTodo)
    } catch (error) {
      console.error("Error completing todo:", error)
      throw new Error("Failed to complete todo")
    }
  }

  async searchSparks(query: string): Promise<Spark[]> {
    return this.readSparks(query)
  }

  async connectSparks(sparkId1: string, sparkId2: string, type?: string, metadata?: any): Promise<void> {
    try {
      // Check if both sparks exist
      const spark1 = await db.spark.findUnique({ where: { id: sparkId1 } })
      const spark2 = await db.spark.findUnique({ where: { id: sparkId2 } })

      if (!spark1 || !spark2) {
        throw new Error("One or both sparks not found")
      }

      // Check if connection already exists
      const existingConnection = await db.sparkConnection.findFirst({
        where: {
          OR: [
            { sparkId1, sparkId2 },
            { sparkId1: sparkId2, sparkId2: sparkId1 }
          ]
        }
      })

      if (existingConnection) {
        throw new Error("Sparks are already connected")
      }

      // Create connection
      await db.sparkConnection.create({
        data: {
          sparkId1,
          sparkId2,
          type: (type as any) || "RELATED_TO",
          metadata: metadata || null
        }
      })

      // Award XP for connecting sparks
      await Promise.all([
        db.spark.update({
          where: { id: sparkId1 },
          data: { xp: spark1.xp + 25 }
        }),
        db.spark.update({
          where: { id: sparkId2 },
          data: { xp: spark2.xp + 25 }
        })
      ])

      // Trigger connection achievement check
      const { AchievementEngine } = await import("@/lib/achievement-engine")
      await AchievementEngine.checkAndAwardAchievements({
        type: "CONNECTION_CREATED",
        userId: spark1.userId,
        data: { sparkId1, sparkId2 }
      })
    } catch (error) {
      console.error("Error connecting sparks:", error)
      throw new Error("Failed to connect sparks")
    }
  }

  async getSuggestions(sparkId: string): Promise<string[]> {
    try {
      const spark = await db.spark.findUnique({
        where: { id: sparkId },
        include: {
          todos: true,
          connections: true
        }
      })

      if (!spark) {
        throw new Error("Spark not found")
      }

      const suggestions: string[] = []

      // Analyze spark content and provide suggestions
      if (!spark.description) {
        suggestions.push("Add a description to better define your spark")
      }

      if (spark.todos.length === 0) {
        suggestions.push("Add some todos to break down your spark into actionable steps")
      }

      const incompleteTodos = spark.todos.filter(todo => !todo.completed)
      if (incompleteTodos.length > 0) {
        suggestions.push(`You have ${incompleteTodos.length} incomplete todos. Focus on completing them`)
      }

      if (spark.connections.length === 0) {
        suggestions.push("Connect this spark to related ideas to build a knowledge network")
      }

      if (spark.xp < 50) {
        suggestions.push("Add more content, complete todos, or connect to other sparks to earn more XP")
      }

      if (spark.status === SparkStatus.SEEDLING && spark.xp > 30) {
        suggestions.push("Consider evolving this spark to Sapling status as it's growing well")
      }

      return suggestions
    } catch (error) {
      console.error("Error getting suggestions:", error)
      throw new Error("Failed to get suggestions")
    }
  }

  async getSparkStats(): Promise<{
    totalSparks: number
    xp: number
    averageLevel: number
    completedTodos: number
    totalTodos: number
    statusBreakdown: Record<string, number>
  }> {
    try {
      const sparks = await db.spark.findMany({
        include: {
          todos: true
        }
      })

      const totalSparks = sparks.length
      const totalXP = sparks.reduce((sum, spark) => sum + spark.xp, 0)
      const averageLevel = totalSparks > 0 ? sparks.reduce((sum, spark) => sum + spark.level, 0) / totalSparks : 0
      
      const allTodos = sparks.flatMap(spark => spark.todos)
      const totalTodos = allTodos.length
      const completedTodos = allTodos.filter(todo => todo.completed).length

      const statusBreakdown = sparks.reduce((acc, spark) => {
        acc[spark.status] = (acc[spark.status] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return {
        totalSparks,
        xp: totalXP,
        averageLevel,
        completedTodos,
        totalTodos,
        statusBreakdown
      }
    } catch (error) {
      console.error("Error getting spark stats:", error)
      throw new Error("Failed to get spark stats")
    }
  }
}

export const sparkMCPServer = new SparkMCPServer()