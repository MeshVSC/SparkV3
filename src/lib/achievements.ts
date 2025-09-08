import { db } from "@/lib/db"
import { Achievement, AchievementType, UserAchievement } from "@/types/spark"

export const DEFAULT_ACHIEVEMENTS: Omit<Achievement, "id" | "createdAt">[] = [
  // Creator Achievements
  {
    name: "First Spark",
    description: "Create your first idea",
    icon: "💡",
    xpReward: 50,
    type: AchievementType.MILESTONE
  },
  {
    name: "Idea Factory",
    description: "Create 10 sparks",
    icon: "🏭",
    xpReward: 100,
    type: AchievementType.MILESTONE
  },
  {
    name: "Visionary",
    description: "Create 100 sparks",
    icon: "🔮",
    xpReward: 500,
    type: AchievementType.MILESTONE
  },
  {
    name: "Idea Master",
    description: "Create 500 sparks",
    icon: "👑",
    xpReward: 1000,
    type: AchievementType.MILESTONE
  },

  // Progress Achievements
  {
    name: "Seedling Gardener",
    description: "Grow 5 sparks to sapling",
    icon: "🌱",
    xpReward: 75,
    type: AchievementType.MILESTONE
  },
  {
    name: "Forest Maker",
    description: "Grow a spark to forest level",
    icon: "🌲",
    xpReward: 200,
    type: AchievementType.MILESTONE
  },
  {
    name: "Evolution Master",
    description: "Complete full spark lifecycle (seedling → forest)",
    icon: "🔄",
    xpReward: 300,
    type: AchievementType.MILESTONE
  },
  {
    name: "Growth Expert",
    description: "Have 20 sparks at tree level or higher",
    icon: "🌳",
    xpReward: 400,
    type: AchievementType.MILESTONE
  },

  // Streak Achievements
  {
    name: "Daily Thinker",
    description: "Create sparks for 7 consecutive days",
    icon: "📅",
    xpReward: 150,
    type: AchievementType.STREAK
  },
  {
    name: "Consistency King",
    description: "Create sparks for 30 consecutive days",
    icon: "👑",
    xpReward: 500,
    type: AchievementType.STREAK
  },
  {
    name: "Unstoppable",
    description: "Create sparks for 100 consecutive days",
    icon: "🚀",
    xpReward: 1500,
    type: AchievementType.STREAK
  },

  // Organization Achievements
  {
    name: "Connector",
    description: "Connect 10 sparks together",
    icon: "🔗",
    xpReward: 100,
    type: AchievementType.COLLECTION
  },
  {
    name: "Network Builder",
    description: "Connect 50 sparks together",
    icon: "🕸️",
    xpReward: 300,
    type: AchievementType.COLLECTION
  },
  {
    name: "Board Master",
    description: "Create sparks in all 4 status categories",
    icon: "📊",
    xpReward: 150,
    type: AchievementType.COLLECTION
  },
  {
    name: "Archive Keeper",
    description: "Organize 50 completed sparks",
    icon: "📚",
    xpReward: 250,
    type: AchievementType.COLLECTION
  },

  // Todo Achievements
  {
    name: "Task Master",
    description: "Complete 100 todos",
    icon: "✅",
    xpReward: 200,
    type: AchievementType.MILESTONE
  },
  {
    name: "Productivity Pro",
    description: "Complete 500 todos",
    icon: "🎯",
    xpReward: 600,
    type: AchievementType.MILESTONE
  },
  {
    name: "Todo Champion",
    description: "Complete 1000 todos",
    icon: "🏆",
    xpReward: 1200,
    type: AchievementType.MILESTONE
  },

  // XP Achievements
  {
    name: "XP Apprentice",
    description: "Earn 1000 total XP",
    icon: "⭐",
    xpReward: 100,
    type: AchievementType.MILESTONE
  },
  {
    name: "XP Expert",
    description: "Earn 5000 total XP",
    icon: "🌟",
    xpReward: 300,
    type: AchievementType.MILESTONE
  },
  {
    name: "XP Master",
    description: "Earn 10000 total XP",
    icon: "💫",
    xpReward: 600,
    type: AchievementType.MILESTONE
  },
  {
    name: "XP Legend",
    description: "Earn 25000 total XP",
    icon: "🌠",
    xpReward: 1000,
    type: AchievementType.MILESTONE
  },

  // Content Achievements
  {
    name: "Content Creator",
    description: "Add descriptions to 50 sparks",
    icon: "📝",
    xpReward: 150,
    type: AchievementType.MILESTONE
  },
  {
    name: "Detail Oriented",
    description: "Add detailed content to 25 sparks",
    icon: "📄",
    xpReward: 200,
    type: AchievementType.MILESTONE
  },
  {
    name: "Tag Enthusiast",
    description: "Use tags on 100 sparks",
    icon: "🏷️",
    xpReward: 175,
    type: AchievementType.MILESTONE
  },

  // Attachment Achievements
  {
    name: "File Collector",
    description: "Attach 50 files to sparks",
    icon: "📁",
    xpReward: 200,
    type: AchievementType.MILESTONE
  },
  {
    name: "Link Builder",
    description: "Add 25 external links to sparks",
    icon: "🔗",
    xpReward: 150,
    type: AchievementType.MILESTONE
  },
  {
    name: "Media Master",
    description: "Attach 100 files to sparks",
    icon: "🎬",
    xpReward: 400,
    type: AchievementType.MILESTONE
  }
]

export class AchievementEngine {
  static async checkAndAwardAchievements(
    userId: string,
    action: string,
    context?: any
  ): Promise<{ unlocked: Achievement[]; totalXp: number }> {
    const unlocked: Achievement[] = []
    let totalXp = 0

    // Get all achievements
    const allAchievements = await db.achievement.findMany()
    
    // Get user's current achievements
    const userAchievements = await db.userAchievement.findMany({
      where: { userId }
    })
    
    const unlockedIds = new Set(userAchievements.map(ua => ua.achievementId))

    // Check each achievement
    for (const achievementTemplate of DEFAULT_ACHIEVEMENTS) {
      if (unlockedIds.has(achievementTemplate.name)) continue

      const shouldUnlock = await this.shouldUnlockAchievement(userId, achievementTemplate, action, context)
      
      if (shouldUnlock) {
        // Find or create the achievement
        let achievement = allAchievements.find(a => a.name === achievementTemplate.name)
        
        if (!achievement) {
          achievement = await db.achievement.create({
            data: {
              ...achievementTemplate,
              id: achievementTemplate.name.toLowerCase().replace(/\s+/g, "-")
            }
          })
        }

        // Award the achievement to the user
        await db.userAchievement.create({
          data: {
            userId,
            achievementId: achievement.id
          }
        })

        unlocked.push(achievement)
        totalXp += achievement.xpReward
      }
    }

    // Award XP to user
    if (totalXp > 0) {
      await db.user.update({
        where: { id: userId },
        data: {
          xp: {
            increment: totalXp
          }
        }
      })
    }

    return { unlocked, totalXp }
  }

  private static async shouldUnlockAchievement(
    userId: string,
    achievement: Omit<Achievement, "id" | "createdAt">,
    action: string,
    context?: any
  ): Promise<boolean> {
    switch (achievement.name) {
      case "First Spark":
        return action === "create_spark" && await this.getUserSparkCount(userId) === 1

      case "Idea Factory":
        return action === "create_spark" && await this.getUserSparkCount(userId) === 10

      case "Visionary":
        return action === "create_spark" && await this.getUserSparkCount(userId) === 100

      case "Idea Master":
        return action === "create_spark" && await this.getUserSparkCount(userId) === 500

      case "Seedling Gardener":
        return action === "spark_evolution" && await this.getSaplingCount(userId) === 5

      case "Forest Maker":
        return action === "spark_evolution" && await this.getForestCount(userId) >= 1

      case "Evolution Master":
        return action === "spark_evolution" && await this.hasCompletedLifecycle(userId)

      case "Growth Expert":
        return action === "spark_evolution" && await this.getTreeAndForestCount(userId) === 20

      case "Task Master":
        return action === "complete_todo" && await this.getCompletedTodoCount(userId) === 100

      case "Productivity Pro":
        return action === "complete_todo" && await this.getCompletedTodoCount(userId) === 500

      case "Todo Champion":
        return action === "complete_todo" && await this.getCompletedTodoCount(userId) === 1000

      case "XP Apprentice":
        return action === "xp_earned" && await this.getUserTotalXP(userId) >= 1000

      case "XP Expert":
        return action === "xp_earned" && await this.getUserTotalXP(userId) >= 5000

      case "XP Master":
        return action === "xp_earned" && await this.getUserTotalXP(userId) >= 10000

      case "XP Legend":
        return action === "xp_earned" && await this.getUserTotalXP(userId) >= 25000

      case "Connector":
        return action === "connect_sparks" && await this.getConnectionCount(userId) === 10

      case "Network Builder":
        return action === "connect_sparks" && await this.getConnectionCount(userId) === 50

      case "Board Master":
        return action === "create_spark" && await this.hasAllStatusTypes(userId)

      case "Content Creator":
        return action === "add_description" && await this.getDescriptionCount(userId) === 50

      case "Detail Oriented":
        return action === "add_content" && await this.getContentCount(userId) === 25

      case "Tag Enthusiast":
        return action === "add_tags" && await this.getTagCount(userId) === 100

      case "File Collector":
        return action === "add_attachment" && await this.getAttachmentCount(userId) === 50

      case "Link Builder":
        return action === "add_attachment" && await this.getLinkCount(userId) === 25

      case "Media Master":
        return action === "add_attachment" && await this.getAttachmentCount(userId) === 100

      default:
        return false
    }
  }

  private static async getUserSparkCount(userId: string): Promise<number> {
    const result = await db.spark.count({ where: { userId } })
    return result
  }

  private static async getSaplingCount(userId: string): Promise<number> {
    const result = await db.spark.count({
      where: { userId, status: "SAPLING" }
    })
    return result
  }

  private static async getForestCount(userId: string): Promise<number> {
    const result = await db.spark.count({
      where: { userId, status: "FOREST" }
    })
    return result
  }

  private static async getTreeAndForestCount(userId: string): Promise<number> {
    const result = await db.spark.count({
      where: { userId, status: { in: ["TREE", "FOREST"] } }
    })
    return result
  }

  private static async hasCompletedLifecycle(userId: string): Promise<boolean> {
    const sparks = await db.spark.findMany({
      where: { userId },
      select: { status: true }
    })

    const statuses = new Set(sparks.map(s => s.status))
    return statuses.has("SEEDLING") && statuses.has("FOREST")
  }

  private static async getCompletedTodoCount(userId: string): Promise<number> {
    const result = await db.todo.count({
      where: {
        spark: { userId },
        completed: true
      }
    })
    return result
  }

  private static async getUserTotalXP(userId: string): Promise<number> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { xp: true }
    })
    return user?.xp || 0
  }

  private static async getConnectionCount(userId: string): Promise<number> {
    const connections = await db.sparkConnection.findMany({
      where: {
        OR: [
          { spark1: { userId } },
          { spark2: { userId } }
        ]
      }
    })
    return connections.length
  }

  private static async hasAllStatusTypes(userId: string): Promise<boolean> {
    const sparks = await db.spark.findMany({
      where: { userId },
      select: { status: true }
    })

    const statuses = new Set(sparks.map(s => s.status))
    return statuses.has("SEEDLING") && statuses.has("SAPLING") && 
           statuses.has("TREE") && statuses.has("FOREST")
  }

  private static async getDescriptionCount(userId: string): Promise<number> {
    const result = await db.spark.count({
      where: { userId, description: { not: null } }
    })
    return result
  }

  private static async getContentCount(userId: string): Promise<number> {
    const result = await db.spark.count({
      where: { userId, content: { not: null } }
    })
    return result
  }

  private static async getTagCount(userId: string): Promise<number> {
    const sparks = await db.spark.findMany({
      where: { userId, tags: { not: null } }
    })
    return sparks.length
  }

  private static async getAttachmentCount(userId: string): Promise<number> {
    const result = await db.attachment.count({
      where: { spark: { userId } }
    })
    return result
  }

  private static async getLinkCount(userId: string): Promise<number> {
    const result = await db.attachment.count({
      where: { 
        spark: { userId },
        type: "LINK"
      }
    })
    return result
  }

  static async getUserAchievements(userId: string): Promise<{
    achievements: (Achievement & { unlockedAt: Date | null })[]
    unlockedCount: number
    totalCount: number
  }> {
    const allAchievements = await db.achievement.findMany()
    const userAchievements = await db.userAchievement.findMany({
      where: { userId },
      include: { achievement: true }
    })

    const unlockedIds = new Set(userAchievements.map(ua => ua.achievementId))
    
    const achievements = allAchievements.map(achievement => ({
      ...achievement,
      unlockedAt: userAchievements.find(ua => ua.achievementId === achievement.id)?.unlockedAt || null
    }))

    return {
      achievements,
      unlockedCount: userAchievements.length,
      totalCount: allAchievements.length
    }
  }

  static async initializeAchievements(): Promise<void> {
    for (const achievementTemplate of DEFAULT_ACHIEVEMENTS) {
      const exists = await db.achievement.findUnique({
        where: { 
          id: achievementTemplate.name.toLowerCase().replace(/\s+/g, "-") 
        }
      })

      if (!exists) {
        await db.achievement.create({
          data: {
            ...achievementTemplate,
            id: achievementTemplate.name.toLowerCase().replace(/\s+/g, "-")
          }
        })
      }
    }
  }
}