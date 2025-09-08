import { db } from "@/lib/db"

export class AchievementService {
  static async checkAndUnlockAchievements(userId: string, action: string, context?: any) {
    try {
      // Get user's current data
      const user = await db.user.findUnique({
        where: { id: userId }
      })

      if (!user) return

      // Get user's sparks with related data
      const sparks = await db.spark.findMany({
        where: { userId },
        include: {
          todos: true,
          attachments: true,
          connections: true
        }
      })

      // Get existing achievements
      const existingAchievements = await db.userAchievement.findMany({
        where: { userId }
      })
      const existingAchievementIds = existingAchievements.map(ua => ua.achievementId)

      // Calculate stats
      const totalSparks = sparks.length
      const statusCounts = sparks.reduce((acc, spark) => {
        acc[spark.status] = (acc[spark.status] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      const completedTodos = sparks.reduce((sum, spark) => 
        sum + (spark.todos?.filter(todo => todo.completed).length || 0), 0
      )
      const totalAttachments = sparks.reduce((sum, spark) => sum + (spark.attachments?.length || 0), 0)
      const totalConnections = sparks.reduce((sum, spark) => sum + (spark.connections?.length || 0), 0)

      // Check achievements based on action
      const achievementsToUnlock = []

      switch (action) {
        case "create_spark":
          if (totalSparks === 1) achievementsToUnlock.push("first-spark")
          if (totalSparks === 10) achievementsToUnlock.push("idea-factory")
          if (totalSparks === 100) achievementsToUnlock.push("visionary")
          break

        case "update_spark_status":
          if (statusCounts["SAPLING"] === 5) achievementsToUnlock.push("seedling-gardener")
          if (statusCounts["FOREST"] === 1) achievementsToUnlock.push("forest-maker")
          if (Object.keys(statusCounts).length === 4) {
            achievementsToUnlock.push("evolution-master")
            achievementsToUnlock.push("board-master")
          }
          break

        case "complete_todo":
          if (completedTodos === 100) achievementsToUnlock.push("task-master")
          break

        case "add_attachment":
          if (totalAttachments === 50) achievementsToUnlock.push("file-collector")
          break

        case "connect_sparks":
          if (totalConnections === 10) achievementsToUnlock.push("connector")
          break
      }

      // Filter out already unlocked achievements
      const newAchievements = achievementsToUnlock.filter(id => !existingAchievementIds.includes(id))

      // Unlock new achievements
      for (const achievementId of newAchievements) {
        const achievement = await db.achievement.findUnique({
          where: { id: achievementId }
        })

        if (achievement) {
          await db.userAchievement.create({
            data: {
              userId,
              achievementId,
              unlockedAt: new Date()
            }
          })

          // Award XP
          await db.user.update({
            where: { id: userId },
            data: {
              xp: {
                increment: achievement.xpReward
              }
            }
          })

          // Update level if needed
          const updatedUser = await db.user.findUnique({
            where: { id: userId }
          })
          
          if (updatedUser) {
            const newLevel = Math.floor(updatedUser.xp / 100) + 1
            if (newLevel > updatedUser.level) {
              await db.user.update({
                where: { id: userId },
                data: { level: newLevel }
              })
            }
          }
        }
      }

      return {
        unlockedAchievements: newAchievements,
        totalUnlocked: newAchievements.length
      }
    } catch (error) {
      console.error("Error checking achievements:", error)
      return { unlockedAchievements: [], totalUnlocked: 0 }
    }
  }
}