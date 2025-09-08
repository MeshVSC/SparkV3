import { NextRequest, NextResponse } from "next/server"
import { sparkMCPServer } from "@/lib/mcp/spark-mcp-server"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; todoId: string } }
) {
  try {
    const todo = await sparkMCPServer.completeTodo(params.id, params.todoId)
    return NextResponse.json(todo)
  } catch (error) {
    console.error("MCP Error completing todo:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to complete todo" },
      { status: 500 }
    )
  }
}