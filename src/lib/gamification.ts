import { db } from "@/lib/db"

export interface XPEvent {
  type: 'SPARK_CREATED' | 'TODO_COMPLETED' | 'ACHIEVEMENT_UNLOCKED' | 'DAILY_LOGIN'
  amount: number
  description?: string
}

export class GamificationService {
  static async awardXP(userId: string, event: XPEvent) {
    try {
      // Get current user data
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { totalXP: true, level: true }
      })

      if (!user) {
        throw new Error("User not found")
      }

      // Calculate new XP and level
      const newXP = user.totalXP + event.amount
      const newLevel = Math.floor(newXP / 1000) + 1

      // Update user
      const updatedUser = await db.user.update({
        where: { id: userId },
        data: {
          totalXP: newXP,
          level: newLevel
        }
      })

      // Check if user leveled up
      const leveledUp = newLevel > user.level

      return {
        success: true,
        xpAwarded: event.amount,
        totalXP: newXP,
        level: newLevel,
        previousLevel: user.level,
        leveledUp
      }
    } catch (error) {
      console.error("Error awarding XP:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }
    }
  }

  static async updateStreak(userId: string) {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { currentStreak: true, lastLoginAt: true }
      })

      if (!user) {
        throw new Error("User not found")
      }

      const now = new Date()
      const lastLogin = user.lastLoginAt ? new Date(user.lastLoginAt) : null
      
      let newStreak = user.currentStreak

      if (lastLogin) {
        const daysSinceLastLogin = Math.floor(
          (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24)
        )

        if (daysSinceLastLogin === 1) {
          // Consecutive day
          newStreak += 1
        } else if (daysSinceLastLogin > 1) {
          // Streak broken
          newStreak = 1
        }
        // If daysSinceLastLogin === 0, same day, no change
      } else {
        // First login
        newStreak = 1
      }

      const updatedUser = await db.user.update({
        where: { id: userId },
        data: {
          currentStreak: newStreak,
          lastLoginAt: now
        }
      })

      return {
        success: true,
        streak: newStreak,
        previousStreak: user.currentStreak
      }
    } catch (error) {
      console.error("Error updating streak:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }
    }
  }

  static async checkAndAwardAchievements(userId: string) {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        include: {
          achievements: {
            include: {
              achievement: true
            }
          },
          sparks: true
        }
      })

      if (!user) {
        throw new Error("User not found")
      }

      const unlockedAchievementIds = user.achievements.map(ua => ua.achievementId)
      
      // Get all achievements
      const allAchievements = await db.achievement.findMany({
        where: {
          id: {
            notIn: unlockedAchievementIds
          }
        }
      })

      const newlyUnlocked = []

      for (const achievement of allAchievements) {
        let shouldUnlock = false

        switch (achievement.type) {
          case 'MILESTONE':
            // Check spark count milestones
            if (achievement.name.includes("First Spark") && user.sparks.length >= 1) {
              shouldUnlock = true
            } else if (achievement.name.includes("10 Sparks") && user.sparks.length >= 10) {
              shouldUnlock = true
            } else if (achievement.name.includes("50 Sparks") && user.sparks.length >= 50) {
              shouldUnlock = true
            }
            break
          
          case 'STREAK':
            // Check streak milestones
            if (achievement.name.includes("7 Day Streak") && user.currentStreak >= 7) {
              shouldUnlock = true
            } else if (achievement.name.includes("30 Day Streak") && user.currentStreak >= 30) {
              shouldUnlock = true
            }
            break
          
          case 'COLLECTION':
            // Check achievement count milestones
            if (achievement.name.includes("First Achievement") && user.achievements.length >= 1) {
              shouldUnlock = true
            } else if (achievement.name.includes("5 Achievements") && user.achievements.length >= 5) {
              shouldUnlock = true
            }
            break
        }

        if (shouldUnlock) {
          await db.userAchievement.create({
            data: {
              userId,
              achievementId: achievement.id
            }
          })
          
          // Award XP for achievement
          await this.awardXP(userId, {
            type: 'ACHIEVEMENT_UNLOCKED',
            amount: achievement.xpReward,
            description: `Unlocked achievement: ${achievement.name}`
          })

          newlyUnlocked.push(achievement)
        }
      }

      return {
        success: true,
        newlyUnlocked
      }
    } catch (error) {
      console.error("Error checking achievements:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }
    }
  }
}