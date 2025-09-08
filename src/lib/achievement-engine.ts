import { db } from "@/lib/db"
import { SparkStatus, AchievementType } from "@/types/spark"

interface AchievementCheck {
  type: "SPARK_CREATED" | "SPARK_UPDATED" | "TODO_COMPLETED" | "ATTACHMENT_ADDED" | "CONNECTION_CREATED"
  userId: string
  data?: any
}

// Event system for achievement unlocks
type AchievementUnlockedListener = (achievement: {
  id: string
  name: string
  description: string
  icon: string
  xpReward: number
  type: AchievementType
}) => void

const achievementListeners: AchievementUnlockedListener[] = []

export function onAchievementUnlocked(listener: AchievementUnlockedListener) {
  achievementListeners.push(listener)
}

export function offAchievementUnlocked(listener: AchievementUnlockedListener) {
  const index = achievementListeners.indexOf(listener)
  if (index > -1) {
    achievementListeners.splice(index, 1)
  }
}

function notifyAchievementUnlocked(achievement: any) {
  achievementListeners.forEach(listener => {
    try {
      listener(achievement)
    } catch (error) {
      console.error("Error in achievement listener:", error)
    }
  })
}

export class AchievementEngine {
  static async checkAndAwardAchievements(event: AchievementCheck) {
    try {
      const user = await db.user.findUnique({
        where: { id: event.userId },
      })

      if (!user) return

      const achievements = await db.achievement.findMany()
      const userAchievements = await db.userAchievement.findMany({
        where: { userId: event.userId },
      })

      const unlockedAchievementIds = userAchievements.map(ua => ua.achievementId)

      // Check different achievement types based on event
      switch (event.type) {
        case "SPARK_CREATED":
          await this.checkSparkAchievements(user, achievements, unlockedAchievementIds)
          break
        case "SPARK_UPDATED":
          await this.checkSparkUpdateAchievements(user, event.data, achievements, unlockedAchievementIds)
          break
        case "TODO_COMPLETED":
          await this.checkTodoAchievements(user, achievements, unlockedAchievementIds)
          break
        case "ATTACHMENT_ADDED":
          await this.checkAttachmentAchievements(user, achievements, unlockedAchievementIds)
          break
        case "CONNECTION_CREATED":
          await this.checkConnectionAchievements(user, achievements, unlockedAchievementIds)
          break
      }
    } catch (error) {
      console.error("Error checking achievements:", error)
    }
  }

  private static async checkSparkAchievements(user: any, achievements: any[], unlockedAchievementIds: string[]) {
    const sparkCount = await db.spark.count({
      where: { userId: user.id },
    })

    // First Spark
    if (sparkCount >= 1 && !unlockedAchievementIds.includes("first-spark")) {
      await this.unlockAchievement(user.id, "first-spark")
    }

    // Idea Factory (10 sparks)
    if (sparkCount >= 10 && !unlockedAchievementIds.includes("idea-factory")) {
      await this.unlockAchievement(user.id, "idea-factory")
    }

    // Visionary (100 sparks)
    if (sparkCount >= 100 && !unlockedAchievementIds.includes("visionary")) {
      await this.unlockAchievement(user.id, "visionary")
    }
  }

  private static async checkSparkUpdateAchievements(user: any, sparkData: any, achievements: any[], unlockedAchievementIds: string[]) {
    if (!sparkData) return

    // Check for status-based achievements
    if (sparkData.status === SparkStatus.SAPLING) {
      const saplingCount = await db.spark.count({
        where: { 
          userId: user.id,
          status: SparkStatus.SAPLING 
        },
      })

      if (saplingCount >= 5 && !unlockedAchievementIds.includes("seedling-gardener")) {
        await this.unlockAchievement(user.id, "seedling-gardener")
      }
    }

    if (sparkData.status === SparkStatus.FOREST && !unlockedAchievementIds.includes("forest-maker")) {
      await this.unlockAchievement(user.id, "forest-maker")
    }

    // Check for evolution master (seedling -> forest progression)
    if (sparkData.status === SparkStatus.FOREST) {
      // This is a simplified check - in a real implementation, you'd track status history
      await this.unlockAchievement(user.id, "evolution-master")
    }
  }

  private static async checkTodoAchievements(user: any, achievements: any[], unlockedAchievementIds: string[]) {
    const completedTodos = await db.todo.count({
      where: {
        spark: {
          userId: user.id,
        },
        completed: true,
      },
    })

    if (completedTodos >= 100 && !unlockedAchievementIds.includes("task-master")) {
      await this.unlockAchievement(user.id, "task-master")
    }
  }

  private static async checkAttachmentAchievements(user: any, achievements: any[], unlockedAchievementIds: string[]) {
    const attachmentCount = await db.attachment.count({
      where: {
        spark: {
          userId: user.id,
        },
      },
    })

    if (attachmentCount >= 50 && !unlockedAchievementIds.includes("file-collector")) {
      await this.unlockAchievement(user.id, "file-collector")
    }
  }

  private static async checkConnectionAchievements(user: any, achievements: any[], unlockedAchievementIds: string[]) {
    const connectionCount = await db.sparkConnection.count({
      where: {
        OR: [
          { sparkId1: { in: user.sparks?.map((s: any) => s.id) || [] } },
          { sparkId2: { in: user.sparks?.map((s: any) => s.id) || [] } },
        ]
      }
    })

    // Connector achievement (10 connections)
    if (connectionCount >= 10 && !unlockedAchievementIds.includes("connector")) {
      await this.unlockAchievement(user.id, "connector")
    }

    // Network Builder achievement (50 connections)
    if (connectionCount >= 50 && !unlockedAchievementIds.includes("network-builder")) {
      await this.unlockAchievement(user.id, "network-builder")
    }
  }

  private static async unlockAchievement(userId: string, achievementId: string) {
    try {
      const achievement = await db.achievement.findUnique({
        where: { id: achievementId },
      })

      if (!achievement) return

      // Check if already unlocked
      const existingUnlock = await db.userAchievement.findUnique({
        where: {
          userId_achievementId: {
            userId,
            achievementId,
          },
        },
      })

      if (existingUnlock) return

      // Unlock achievement
      await db.userAchievement.create({
        data: {
          userId,
          achievementId,
          unlockedAt: new Date(),
        },
      })

      // Award XP
      await db.user.update({
        where: { id: userId },
        data: {
          totalXP: {
            increment: achievement.xpReward,
          },
          level: {
            increment: Math.floor(achievement.xpReward / 100),
          },
        },
      })

      console.log(`Achievement unlocked: ${achievement.name} (+${achievement.xpReward} XP)`)

      // Notify listeners
      notifyAchievementUnlocked(achievement)
    } catch (error) {
      console.error("Error unlocking achievement:", error)
    }
  }

  static async getUserProgress(userId: string) {
    try {
      const [
        totalSparks,
        completedTodos,
        totalAttachments,
        saplingCount,
        forestCount,
        totalConnections,
        userAchievements
      ] = await Promise.all([
        db.spark.count({ where: { userId } }),
        db.todo.count({ 
          where: { 
            spark: { userId },
            completed: true 
          } 
        }),
        db.attachment.count({ 
          where: { 
            spark: { userId }
          } 
        }),
        db.spark.count({ 
          where: { 
            userId,
            status: SparkStatus.SAPLING 
          } 
        }),
        db.spark.count({ 
          where: { 
            userId,
            status: SparkStatus.FOREST 
          } 
        }),
        db.sparkConnection.count({
          where: {
            OR: [
              { sparkId1: { in: (await db.spark.findMany({ where: { userId } })).map(s => s.id) } },
              { sparkId2: { in: (await db.spark.findMany({ where: { userId } })).map(s => s.id) } },
            ]
          }
        }),
        db.userAchievement.findMany({
          where: { userId },
          include: { achievement: true },
        }),
      ])

      return {
        totalSparks,
        completedTodos,
        totalAttachments,
        saplingCount,
        forestCount,
        totalConnections,
        unlockedAchievements: userAchievements.length,
        totalAchievements: 15, // Total number of predefined achievements
        recentAchievements: userAchievements
          .sort((a, b) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime())
          .slice(0, 5),
      }
    } catch (error) {
      console.error("Error getting user progress:", error)
      return null
    }
  }
}