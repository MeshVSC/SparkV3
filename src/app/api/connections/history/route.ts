import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { connectionHistoryService } from "@/lib/connection-history-service"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    const sparkIds = searchParams.get('sparkIds')?.split(',')

    let history
    if (sparkIds && sparkIds.length > 0) {
      // Get history for specific sparks
      history = await connectionHistoryService.getSparkConnectionHistory(
        sparkIds,
        { limit, offset }
      )
    } else {
      // Get all history for the user
      history = await connectionHistoryService.getUserConnectionHistory(
        session.user.id,
        { limit, offset }
      )
    }

    // Get statistics
    const stats = await connectionHistoryService.getHistoryStats(session.user.id)

    return NextResponse.json({ 
      history,
      stats,
      pagination: {
        limit,
        offset,
        hasMore: history.length === limit
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