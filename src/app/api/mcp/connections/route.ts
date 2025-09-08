import { NextRequest, NextResponse } from "next/server"
import { sparkMCPServer } from "@/lib/mcp/spark-mcp-server"
import { ConnectionType } from "@/types/spark"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sparkId1, sparkId2, type, metadata } = body

    if (!sparkId1 || !sparkId2) {
      return NextResponse.json(
        { error: "Both sparkId1 and sparkId2 are required" },
        { status: 400 }
      )
    }

    // Validate connection type
    if (type && !Object.values(ConnectionType).includes(type)) {
      return NextResponse.json(
        { error: "Invalid connection type" },
        { status: 400 }
      )
    }

    await sparkMCPServer.connectSparks(sparkId1, sparkId2, type, metadata)
    return NextResponse.json({ success: true, message: "Sparks connected successfully" })
  } catch (error) {
    console.error("MCP Error connecting sparks:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to connect sparks" },
      { status: 500 }
    )
  }
}