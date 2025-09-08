import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const { sql, params } = await request.json()
    
    // This is a simplified implementation - in production, you'd want proper SQL parsing
    // For now, we'll handle basic queries for the MCP server
    
    if (sql.includes("sparks")) {
      const sparks = await db.spark.findMany({
        include: {
          todos: true,
          attachments: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
      })
      return NextResponse.json(sparks)
    }
    
    if (sql.includes("todos")) {
      const todos = await db.todo.findMany({
        include: {
          spark: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      })
      return NextResponse.json(todos)
    }
    
    if (sql.includes("achievements")) {
      const achievements = await db.achievement.findMany({
        include: {
          userAchievements: true,
        },
      })
      return NextResponse.json(achievements)
    }
    
    if (sql.includes("user")) {
      const user = await db.user.findUnique({
        where: { email: "default@example.com" },
      })
      return NextResponse.json(user)
    }
    
    return NextResponse.json({ error: "Query not supported" }, { status: 400 })
  } catch (error) {
    console.error("MCP query error:", error)
    return NextResponse.json(
      { error: "Failed to execute query" },
      { status: 500 }
    )
  }
}