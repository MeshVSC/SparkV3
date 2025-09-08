import { NextRequest, NextResponse } from "next/server"
import { sparkMCPServer } from "@/lib/mcp/spark-mcp-server"

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const spark = await sparkMCPServer.updateSpark(params.id, body)
    return NextResponse.json(spark)
  } catch (error) {
    console.error("MCP Error updating spark:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update spark" },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sparks = await sparkMCPServer.readSparks()
    const spark = sparks.find(s => s.id === params.id)
    
    if (!spark) {
      return NextResponse.json(
        { error: "Spark not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(spark)
  } catch (error) {
    console.error("MCP Error getting spark:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get spark" },
      { status: 500 }
    )
  }
}