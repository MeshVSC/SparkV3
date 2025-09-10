import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const defaultUser = await db.user.upsert({
      where: { email: "default@example.com" },
      update: {},
      create: {
        email: "default@example.com",
        name: "Default User",
        totalXP: 0,
        level: 1,
      },
    })

    return NextResponse.json(defaultUser)
  } catch (error) {
    console.error("Error initializing user:", error)
    return NextResponse.json(
      { error: "Failed to initialize user" },
      { status: 500 }
    )
  }
}