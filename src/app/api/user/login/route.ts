import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { GamificationService } from "@/lib/gamification"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Update user streak
    const streakResult = await GamificationService.updateStreak(session.user.id)
    
    if (!streakResult.success) {
      return NextResponse.json({ error: "Failed to update streak" }, { status: 500 })
    }

    // Award XP for daily login (only if streak increased or first login)
    let xpResult = null
    if (streakResult.streak !== streakResult.previousStreak) {
      xpResult = await GamificationService.awardXP(session.user.id, {
        type: 'DAILY_LOGIN',
        amount: 50, // 50 XP for daily login
        description: 'Daily login bonus'
      })
    }

    // Check for new achievements
    const achievementResult = await GamificationService.checkAndAwardAchievements(session.user.id)

    return NextResponse.json({
      message: "Login processed successfully",
      streak: streakResult.streak,
      previousStreak: streakResult.previousStreak,
      xpAwarded: xpResult?.xpAwarded || 0,
      newAchievements: achievementResult.newlyUnlocked || []
    })
  } catch (error) {
    console.error("Login event error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}