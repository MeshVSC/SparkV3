import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const todos = await db.todo.findMany({
      where: { sparkId: params.id },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json(todos)
  } catch (error) {
    console.error("Error fetching todos:", error)
    return NextResponse.json(
      { error: "Failed to fetch todos" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    
    const existingSpark = await db.spark.findUnique({
      where: { id: params.id },
    })

    if (!existingSpark) {
      return NextResponse.json(
        { error: "Spark not found" },
        { status: 404 }
      )
    }

    const todo = await db.todo.create({
      data: {
        sparkId: params.id,
        title: body.title,
        description: body.description,
        completed: body.completed || false,
        type: body.type,
        priority: body.priority,
        positionX: body.positionX,
        positionY: body.positionY,
      },
    })

    return NextResponse.json(todo, { status: 201 })
  } catch (error) {
    console.error("Error creating todo:", error)
    return NextResponse.json(
      { error: "Failed to create todo" },
      { status: 500 }
    )
  }
}