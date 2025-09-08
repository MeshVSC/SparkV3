import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// Predefined achievements
const ACHIEVEMENTS = [
  {
    id: "first-spark",
    name: "First Spark",
    description: "Create your first spark",
    icon: "🌱",
    xpReward: 50,
    type: "MILESTONE"
  },
  {
    id: "idea-factory",
    name: "Idea Factory",
    description: "Create 10 sparks",
    icon: "🏭",
    xpReward: 100,
    type: "MILESTONE"
  },
  {
    id: "visionary",
    name: "Visionary",
    description: "Create 100 sparks",
    icon: "🔮",
    xpReward: 500,
    type: "MILESTONE"
  },
  {
    id: "seedling-gardener",
    name: "Seedling Gardener",
    description: "Grow 5 sparks to sapling",
    icon: "🌿",
    xpReward: 75,
    type: "MILESTONE"
  },
  {
    id: "forest-maker",
    name: "Forest Maker",
    description: "Grow a spark to forest level",
    icon: "🌲",
    xpReward: 200,
    type: "MILESTONE"
  },
  {
    id: "evolution-master",
    name: "Evolution Master",
    description: "Complete full spark lifecycle (seedling → forest)",
    icon: "🔄",
    xpReward: 300,
    type: "MILESTONE"
  },
  {
    id: "daily-thinker",
    name: "Daily Thinker",
    description: "7 day login streak",
    icon: "📅",
    xpReward: 150,
    type: "STREAK"
  },
  {
    id: "consistency-king",
    name: "Consistency King",
    description: "30 day streak",
    icon: "👑",
    xpReward: 500,
    type: "STREAK"
  },
  {
    id: "unstoppable",
    name: "Unstoppable",
    description: "100 day streak",
    icon: "🚀",
    xpReward: 1000,
    type: "STREAK"
  },
  {
    id: "connector",
    name: "Connector",
    description: "Link 10 sparks together",
    icon: "🔗",
    xpReward: 125,
    type: "COLLECTION"
  },
  {
    id: "board-master",
    name: "Board Master",
    description: "Create 5 different boards",
    icon: "📋",
    xpReward: 175,
    type: "COLLECTION"
  },
  {
    id: "archive-keeper",
    name: "Archive Keeper",
    description: "Organize 50 completed sparks",
    icon: "📚",
    xpReward: 250,
    type: "COLLECTION"
  },
  {
    id: "task-master",
    name: "Task Master",
    description: "Complete 100 todos",
    icon: "✅",
    xpReward: 300,
    type: "MILESTONE"
  },
  {
    id: "file-collector",
    name: "File Collector",
    description: "Attach 50 files to sparks",
    icon: "📁",
    xpReward: 200,
    type: "COLLECTION"
  },
  {
    id: "tag-expert",
    name: "Tag Expert",
    description: "Use 100 different tags",
    icon: "🏷️",
    xpReward: 150,
    type: "COLLECTION"
  }
]

export async function GET(request: NextRequest) {
  try {
    // Get or create default user
    let user = await db.user.findUnique({
      where: { email: "default@example.com" },
    })
    
    if (!user) {
      user = await db.user.create({
        data: {
          email: "default@example.com",
          name: "Default User",
          xp: 0,
          level: 1,
        },
      })
    }

    // Get user's achievements
    const userAchievements = await db.userAchievement.findMany({
      where: { userId: user.id },
      include: {
        achievement: true,
      },
    })

    // Get all available achievements
    const allAchievements = await db.achievement.findMany()

    // If no achievements exist, seed them
    if (allAchievements.length === 0) {
      for (const achievementData of ACHIEVEMENTS) {
        await db.achievement.create({
          data: achievementData,
        })
      }
    }

    // Return achievements with unlock status
    const achievementsWithStatus = await db.achievement.findMany({
      include: {
        userAchievements: {
          where: { userId: user.id },
        },
      },
    })

    const formattedAchievements = achievementsWithStatus.map(achievement => ({
      ...achievement,
      unlocked: achievement.userAchievements.length > 0,
      unlockedAt: achievement.userAchievements[0]?.unlockedAt,
    }))

    return NextResponse.json(formattedAchievements)
  } catch (error) {
    console.error("Error fetching achievements:", error)
    return NextResponse.json(
      { error: "Failed to fetch achievements" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { achievementId } = await request.json()

    if (!achievementId) {
      return NextResponse.json(
        { error: "Achievement ID is required" },
        { status: 400 }
      )
    }

    // Get or create default user
    let user = await db.user.findUnique({
      where: { email: "default@example.com" },
    })
    
    if (!user) {
      user = await db.user.create({
        data: {
          email: "default@example.com",
          name: "Default User",
          xp: 0,
          level: 1,
        },
      })
    }

    // Check if achievement exists
    const achievement = await db.achievement.findUnique({
      where: { id: achievementId },
    })

    if (!achievement) {
      return NextResponse.json(
        { error: "Achievement not found" },
        { status: 404 }
      )
    }

    // Check if already unlocked
    const existingUnlock = await db.userAchievement.findUnique({
      where: {
        userId_achievementId: {
          userId: user.id,
          achievementId: achievement.id,
        },
      },
    })

    if (existingUnlock) {
      return NextResponse.json(
        { error: "Achievement already unlocked" },
        { status: 400 }
      )
    }

    // Unlock achievement
    const userAchievement = await db.userAchievement.create({
      data: {
        userId: user.id,
        achievementId: achievement.id,
        unlockedAt: new Date(),
      },
      include: {
        achievement: true,
      },
    })

    // Award XP to user
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        xp: user.xp + achievement.xpReward,
        level: Math.floor((user.xp + achievement.xpReward) / 100) + 1,
      },
    })

    return NextResponse.json({
      userAchievement,
      user: updatedUser,
      message: `Achievement "${achievement.name}" unlocked! +${achievement.xpReward} XP`,
    })
  } catch (error) {
    console.error("Error unlocking achievement:", error)
    return NextResponse.json(
      { error: "Failed to unlock achievement" },
      { status: 500 }
    )
  }
}