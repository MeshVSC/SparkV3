import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { AchievementEngine } from "@/lib/achievements"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; todoId: string } }
) {
  try {
    const todo = await db.todo.findFirst({
      where: { 
        id: params.todoId,
        sparkId: params.id,
      },
    })

    if (!todo) {
      return NextResponse.json(
        { error: "Todo not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(todo)
  } catch (error) {
    console.error("Error fetching todo:", error)
    return NextResponse.json(
      { error: "Failed to fetch todo" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; todoId: string } }
) {
  try {
    const body = await request.json()
    
    const existingTodo = await db.todo.findFirst({
      where: { 
        id: params.todoId,
        sparkId: params.id,
      },
    })

    if (!existingTodo) {
      return NextResponse.json(
        { error: "Todo not found" },
        { status: 404 }
      )
    }

    // Get the spark early for both XP and achievement logic
    const spark = await db.spark.findUnique({
      where: { id: params.id },
    })

    // Check if todo is being marked as completed (was not completed before)
    const isCompleted = body.completed
    const wasCompleted = existingTodo.completed
    
    let xpAward = 0
    if (isCompleted && !wasCompleted && spark) {
      // Award XP for completing todo
      xpAward = 20
      
      const newSparkXp = spark.xp + xpAward
      const newSparkLevel = Math.floor(newSparkXp / 100) + 1
      
      // Update spark XP and level
      await db.spark.update({
        where: { id: params.id },
        data: {
          xp: newSparkXp,
          level: newSparkLevel,
        },
      })
      
      // Get user to update their XP
      const user = await db.user.findUnique({
        where: { id: spark.userId },
      })
      
      if (user) {
        const newUserXp = user.totalXP + xpAward
        const newUserLevel = Math.floor(newUserXp / 100) + 1
        
        await db.user.update({
          where: { id: user.id },
          data: {
            totalXP: newUserXp,
            level: newUserLevel,
          },
        })
      }
    }

    // Check for achievements when completing a todo
    if (isCompleted && !wasCompleted && spark) {
      try {
        await AchievementEngine.checkAndAwardAchievements({
          type: "TODO_COMPLETED",
          userId: spark.userId,
          data: { 
            sparkId: params.id, 
            todoId: params.todoId 
          }
        })
      } catch (achievementError) {
        console.error("Error checking achievements:", achievementError)
        // Don't fail the todo update if achievement checking fails
      }
    }

    const todo = await db.todo.update({
      where: { id: params.todoId },
      data: {
        title: body.title,
        description: body.description,
        completed: body.completed,
        type: body.type,
        priority: body.priority,
        positionX: body.positionX,
        positionY: body.positionY,
        completedAt: body.completed ? new Date() : null,
      },
    })

    return NextResponse.json({ ...todo, xpAwarded: xpAward })
  } catch (error) {
    console.error("Error updating todo:", error)
    return NextResponse.json(
      { error: "Failed to update todo" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; todoId: string } }
) {
  try {
    const existingTodo = await db.todo.findFirst({
      where: { 
        id: params.todoId,
        sparkId: params.id,
      },
    })

    if (!existingTodo) {
      return NextResponse.json(
        { error: "Todo not found" },
        { status: 404 }
      )
    }

    await db.todo.delete({
      where: { id: params.todoId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting todo:", error)
    return NextResponse.json(
      { error: "Failed to delete todo" },
      { status: 500 }
    )
  }
}