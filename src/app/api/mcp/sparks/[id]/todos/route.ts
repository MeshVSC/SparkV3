import { NextRequest, NextResponse } from "next/server"
import { sparkMCPServer } from "@/lib/mcp/spark-mcp-server"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { title, description, priority } = body

    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: "Title is required and must be a string" },
        { status: 400 }
      )
    }

    const todo = await sparkMCPServer.addTodo(params.id, title, description, priority)
    return NextResponse.json(todo, { status: 201 })
  } catch (error) {
    console.error("MCP Error adding todo:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add todo" },
      { status: 500 }
    )
  }
}