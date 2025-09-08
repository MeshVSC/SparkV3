import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }
    
    const user = await db.user.findUnique({
      where: { id: session.user.id },
    })
    
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Get user's sparks
    const sparks = await db.spark.findMany({
      where: { userId: user.id },
      include: {
        todos: true,
        attachments: true,
      },
    })

    // Calculate stats
    const totalSparks = sparks.length
    const totalXp = sparks.reduce((sum, spark) => sum + spark.xp, 0)
    const completedTodos = sparks.reduce((sum, spark) => 
      sum + (spark.todos?.filter(todo => todo.completed).length || 0), 0
    )
    const totalTodos = sparks.reduce((sum, spark) => 
      sum + (spark.todos?.length || 0), 0
    )
    const totalAttachments = sparks.reduce((sum, spark) => 
      sum + (spark.attachments?.length || 0), 0
    )

    // Calculate level progress
    const xpForCurrentLevel = (user.level - 1) * 100
    const xpForNextLevel = user.level * 100
    const levelProgress = ((user.totalXP - xpForCurrentLevel) / 100) * 100

    // Status breakdown
    const statusBreakdown = sparks.reduce((acc, spark) => {
      acc[spark.status] = (acc[spark.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const stats = {
      user: {
        id: user.id,
        name: user.name,
        totalXP: user.totalXP,
        level: user.level,
        levelProgress,
        xpToNextLevel: xpForNextLevel - user.totalXP,
      },
      sparks: {
        total: totalSparks,
        totalXp,
        statusBreakdown,
      },
      todos: {
        total: totalTodos,
        completed: completedTodos,
        completionRate: totalTodos > 0 ? (completedTodos / totalTodos) * 100 : 0,
      },
      attachments: {
        total: totalAttachments,
      },
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error("Error fetching user stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch user stats" },
      { status: 500 }
    )
  }
}