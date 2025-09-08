import { NextRequest, NextResponse } from "next/server"
import { sparkMCPServer } from "@/lib/mcp/spark-mcp-server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")

    const sparks = await sparkMCPServer.readSparks(query || undefined)
    return NextResponse.json(sparks)
  } catch (error) {
    console.error("MCP Error reading sparks:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read sparks" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, status } = body

    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: "Title is required and must be a string" },
        { status: 400 }
      )
    }

    const spark = await sparkMCPServer.createSpark(title, description, status)
    return NextResponse.json(spark, { status: 201 })
  } catch (error) {
    console.error("MCP Error creating spark:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create spark" },
      { status: 500 }
    )
  }
}