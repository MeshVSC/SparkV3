import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { AchievementEngine } from "@/lib/achievement-engine"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }
    
    const sparks = await db.spark.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        todos: true,
        attachments: true,
        connections: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    })

    return NextResponse.json(sparks)
  } catch (error) {
    console.error("Error fetching sparks:", error)
    return NextResponse.json(
      { error: "Failed to fetch sparks" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Get the authenticated user from the session
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }
    
    // Get the user from the database
    const user = await db.user.findUnique({
      where: { id: session.user.id },
    })
    
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }
    
    // Award XP for creating spark
    const xpAward = 10
    const newUserXp = user.totalXP + xpAward
    const newUserLevel = Math.floor(newUserXp / 100) + 1
    
    // Update user XP and level
    await db.user.update({
      where: { id: user.id },
      data: {
        totalXP: newUserXp,
        level: newUserLevel,
      },
    })
    
    const spark = await db.spark.create({
      data: {
        userId: user.id,
        title: body.title,
        description: body.description,
        content: body.content,
        status: body.status,
        xp: xpAward, // Initial XP for the spark
        level: 1,
        positionX: body.positionX,
        positionY: body.positionY,
        color: body.color,
        tags: body.tags,
      },
      include: {
        todos: true,
        attachments: true,
        connections: true,
      },
    })

    // Check for achievements
    try {
      await AchievementEngine.checkAndAwardAchievements({
        type: "SPARK_CREATED",
        userId: user.id,
        data: spark
      })
    } catch (achievementError) {
      console.error("Error checking achievements:", achievementError)
      // Don't fail the spark creation if achievement checking fails
    }

    return NextResponse.json(spark, { status: 201 })
  } catch (error) {
    console.error("Error creating spark:", error)
    return NextResponse.json(
      { error: "Failed to create spark" },
      { status: 500 }
    )
  }
}