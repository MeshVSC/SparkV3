import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userAchievements = await db.userAchievement.findMany({
      where: { userId: params.userId },
      include: {
        achievement: true
      },
      orderBy: {
        unlockedAt: "desc"
      }
    })

    return NextResponse.json(userAchievements)
  } catch (error) {
    console.error("Error fetching user achievements:", error)
    return NextResponse.json(
      { error: "Failed to fetch user achievements" },
      { status: 500 }
    )
  }
}