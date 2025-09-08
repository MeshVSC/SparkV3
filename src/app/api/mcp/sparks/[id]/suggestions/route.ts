import { NextRequest, NextResponse } from "next/server"
import { sparkMCPServer } from "@/lib/mcp/spark-mcp-server"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const suggestions = await sparkMCPServer.getSuggestions(params.id)
    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error("MCP Error getting suggestions:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get suggestions" },
      { status: 500 }
    )
  }
}