import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { AchievementEngine } from "@/lib/achievement-engine"

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

    const progress = await AchievementEngine.getUserProgress(user.id)
    
    if (!progress) {
      return NextResponse.json(
        { error: "Failed to get user progress" },
        { status: 500 }
      )
    }

    return NextResponse.json(progress)
  } catch (error) {
    console.error("Error fetching user progress:", error)
    return NextResponse.json(
      { error: "Failed to fetch user progress" },
      { status: 500 }
    )
  }
}