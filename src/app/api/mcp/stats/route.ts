import { NextRequest, NextResponse } from "next/server"
import { sparkMCPServer } from "@/lib/mcp/spark-mcp-server"

export async function GET(request: NextRequest) {
  try {
    const stats = await sparkMCPServer.getSparkStats()
    return NextResponse.json(stats)
  } catch (error) {
    console.error("MCP Error getting stats:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get stats" },
      { status: 500 }
    )
  }
}