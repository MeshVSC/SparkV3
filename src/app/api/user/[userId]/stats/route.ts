import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Get user data
    const user = await db.user.findUnique({
      where: { id: params.userId }
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Get user's sparks
    const sparks = await db.spark.findMany({
      where: { userId: params.userId },
      include: {
        todos: true,
        attachments: true,
        connections: true
      }
    })

    // Get user's achievements
    const userAchievements = await db.userAchievement.findMany({
      where: { userId: params.userId },
      include: {
        achievement: true
      }
    })

    // Calculate stats
    const totalSparks = sparks.length
    const totalXP = sparks.reduce((sum, spark) => sum + spark.xp, 0)
    const totalTodos = sparks.reduce((sum, spark) => sum + (spark.todos?.length || 0), 0)
    const completedTodos = sparks.reduce((sum, spark) => 
      sum + (spark.todos?.filter(todo => todo.completed).length || 0), 0
    )
    const totalAttachments = sparks.reduce((sum, spark) => sum + (spark.attachments?.length || 0), 0)
    const totalConnections = sparks.reduce((sum, spark) => sum + (spark.connections?.length || 0), 0)

    // Status breakdown
    const statusCounts = sparks.reduce((acc, spark) => {
      acc[spark.status] = (acc[spark.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Calculate level progress
    const currentLevelXP = (user.level - 1) * 100
    const nextLevelXP = user.level * 100
    const levelProgress = ((user.totalXP - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100
    const xpToNextLevel = nextLevelXP - user.totalXP

    // Check for potential achievements
    const potentialAchievements = []
    
    // First spark
    if (totalSparks === 1) {
      // potentialAchievements.push("first-spark")
    }
    
    // Idea factory (10 sparks)
    if (totalSparks >= 10) {
      // potentialAchievements.push("idea-factory")
    }
    
    // Visionary (100 sparks)
    if (totalSparks >= 100) {
      // potentialAchievements.push("visionary")
    }
    
    // Seedling gardener (5 saplings)
    if (statusCounts["SAPLING"] >= 5) {
      // potentialAchievements.push("seedling-gardener")
    }
    
    // Forest maker (1 forest)
    if (statusCounts["FOREST"] >= 1) {
      // potentialAchievements.push("forest-maker")
    }
    
    // Evolution master (has all statuses)
    if (Object.keys(statusCounts).length === 4) {
      // potentialAchievements.push("evolution-master")
    }
    
    // Task master (100 todos)
    if (completedTodos >= 100) {
      // potentialAchievements.push("task-master")
    }
    
    // File collector (50 attachments)
    if (totalAttachments >= 50) {
      // potentialAchievements.push("file-collector")
    }
    
    // Connector (10 connections)
    if (totalConnections >= 10) {
      // potentialAchievements.push("connector")
    }
    
    // Board master (all statuses)
    if (Object.keys(statusCounts).length === 4) {
      // potentialAchievements.push("board-master")
    }

    // Filter out already unlocked achievements
    const unlockedAchievementIds = userAchievements.map(ua => ua.achievementId)
    const newAchievements = potentialAchievements.filter(id => !unlockedAchievementIds.includes(id))

    return NextResponse.json({
      user: {
        id: user.id,
        xp: user.totalXP,
        level: user.level,
        levelProgress,
        xpToNextLevel
      },
      sparks: {
        total: totalSparks,
        statusCounts
      },
      todos: {
        total: totalTodos,
        completed: completedTodos
      },
      attachments: {
        total: totalAttachments
      },
      connections: {
        total: totalConnections
      },
      achievements: {
        total: userAchievements.length,
        unlocked: userAchievements,
        newAchievements
      }
    })
  } catch (error) {
    console.error("Error fetching user stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch user stats" },
      { status: 500 }
    )
  }
}