import { NextRequest, NextResponse } from "next/server"
import { AchievementEngine } from "@/lib/achievements"

export async function POST(request: NextRequest) {
  try {
    await AchievementEngine.initializeAchievements()
    return NextResponse.json({ success: true, message: "Achievements initialized successfully" })
  } catch (error) {
    console.error("Error initializing achievements:", error)
    return NextResponse.json(
      { error: "Failed to initialize achievements" },
      { status: 500 }
    )
  }
}