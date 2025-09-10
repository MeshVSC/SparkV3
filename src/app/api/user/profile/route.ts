import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  avatar: z.string().url().optional(),
})

const updatePreferencesSchema = z.object({
  theme: z.enum(["LIGHT", "DARK", "AUTO"]).optional(),
  notifications: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
  defaultSparkColor: z.string().optional(),
  viewMode: z.enum(["CANVAS", "KANBAN", "TIMELINE"]).optional(),
})

// GET /api/user/profile - Get user profile
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: {
        preferences: true,
        achievements: {
          include: {
            achievement: true,
          },
          orderBy: {
            unlockedAt: "desc",
          },
        },
        _count: {
          select: {
            sparks: true,
            achievements: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Calculate XP needed for next level
    const xpForNextLevel = user.level * 1000
    const xpProgress = (user.totalXP % 1000) / 1000

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        totalXP: user.totalXP,
        level: user.level,
        currentStreak: user.currentStreak,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        preferences: user.preferences,
        achievements: user.achievements,
        stats: {
          totalSparks: user._count.sparks,
          totalAchievements: user._count.achievements,
          xpForNextLevel,
          xpProgress,
        },
      },
    })
  } catch (error) {
    console.error("Get profile error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// PUT /api/user/profile - Update user profile
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { name, avatar } = updateProfileSchema.parse(body)

    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: {
        ...(name && { name }),
        ...(avatar && { avatar }),
      },
      include: {
        preferences: true,
      },
    })

    return NextResponse.json({
      message: "Profile updated successfully",
      user: updatedUser,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      )
    }

    console.error("Update profile error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// PATCH /api/user/profile/preferences - Update user preferences
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const preferences = updatePreferencesSchema.parse(body)

    const updatedPreferences = await db.userPreferences.upsert({
      where: { userId: session.user.id },
      update: preferences,
      create: {
        userId: session.user.id,
        ...preferences,
      },
    })

    return NextResponse.json({
      message: "Preferences updated successfully",
      preferences: updatedPreferences,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      )
    }

    console.error("Update preferences error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}