import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { connectionHistoryService } from "@/lib/connection-history-service"
import { z } from "zod"

const rollbackSchema = z.object({
  historyId: z.string(),
  reason: z.string().optional()
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { historyId, reason } = rollbackSchema.parse(body)

    // Perform rollback
    const result = await connectionHistoryService.rollbackToHistoryEntry(
      historyId,
      session.user.id,
      session.user.name || session.user.email || 'Unknown User'
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Rollback failed" },
        { status: 400 }
      )
    }

    // Return success with details
    const response: any = {
      success: true,
      message: "Successfully rolled back connection change"
    }

    if (result.restoredConnection) {
      response.restoredConnection = result.restoredConnection
    }

    if (result.deletedConnectionId) {
      response.deletedConnectionId = result.deletedConnectionId
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error("Error rolling back connection:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request data", details: error.errors }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to rollback connection" },
      { status: 500 }
    )
  }
}