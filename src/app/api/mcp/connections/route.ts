import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { sparkMCPServer } from "@/lib/mcp/spark-mcp-server"
import { ConnectionType } from "@/types/spark"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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

    await sparkMCPServer.connectSparks(
      sparkId1, 
      sparkId2, 
      type, 
      metadata,
      session.user.id,
      session.user.name || session.user.email || 'Unknown User'
    )
    
    return NextResponse.json({ success: true, message: "Sparks connected successfully" })
  } catch (error) {
    console.error("MCP Error connecting sparks:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to connect sparks" },
      { status: 500 }
    )
  }
}