import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { connectionHistoryService } from "@/lib/connection-history-service"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // First verify the connection belongs to the user
    const connection = await db.sparkConnection.findFirst({
      where: {
        id: params.id,
        OR: [
          { spark1: { userId: session.user.id } },
          { spark2: { userId: session.user.id } }
        ]
      }
    })

    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 })
    }

    // Get history for this connection
    const history = await connectionHistoryService.getConnectionHistory(
      connection.sparkId1,
      connection.sparkId2,
      { limit, offset }
    )

    return NextResponse.json({ 
      history,
      connection: {
        id: connection.id,
        sparkId1: connection.sparkId1,
        sparkId2: connection.sparkId2,
        type: connection.type,
        metadata: connection.metadata,
        createdAt: connection.createdAt
      }
    })

  } catch (error) {
    console.error("Error fetching connection history:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch connection history" },
      { status: 500 }
    )
  }
}