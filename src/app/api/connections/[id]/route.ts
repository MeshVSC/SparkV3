import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { connectionHistoryService } from "@/lib/connection-history-service"
import { ConnectionType } from "@prisma/client"
import { ConnectionChangeType } from "@/lib/connection-history-service"
import { z } from "zod"

const updateConnectionSchema = z.object({
  type: z.nativeEnum(ConnectionType).optional(),
  metadata: z.any().optional(),
  reason: z.string().optional()
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const connection = await db.sparkConnection.findFirst({
      where: {
        id: params.id,
        OR: [
          { spark1: { userId: session.user.id } },
          { spark2: { userId: session.user.id } }
        ]
      },
      include: {
        spark1: {
          select: { id: true, title: true, color: true, status: true }
        },
        spark2: {
          select: { id: true, title: true, color: true, status: true }
        }
      }
    })

    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 })
    }

    return NextResponse.json({ connection })

  } catch (error) {
    console.error("Error fetching connection:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch connection" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get current connection
    const currentConnection = await db.sparkConnection.findFirst({
      where: {
        id: params.id,
        OR: [
          { spark1: { userId: session.user.id } },
          { spark2: { userId: session.user.id } }
        ]
      }
    })

    if (!currentConnection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = updateConnectionSchema.parse(body)
    const { type, metadata, reason } = validatedData

    // Store previous state for history
    const beforeState = {
      id: currentConnection.id,
      sparkId1: currentConnection.sparkId1,
      sparkId2: currentConnection.sparkId2,
      type: currentConnection.type,
      metadata: currentConnection.metadata,
      createdAt: currentConnection.createdAt
    }

    // Update connection
    const updatedConnection = await db.sparkConnection.update({
      where: { id: params.id },
      data: {
        ...(type && { type }),
        ...(metadata !== undefined && { metadata })
      }
    })

    // Record in history
    await connectionHistoryService.recordChange({
      connectionId: updatedConnection.id,
      sparkId1: updatedConnection.sparkId1,
      sparkId2: updatedConnection.sparkId2,
      changeType: ConnectionChangeType.MODIFIED,
      userId: session.user.id,
      username: session.user.name || session.user.email || 'Unknown User',
      beforeState,
      afterState: {
        id: updatedConnection.id,
        sparkId1: updatedConnection.sparkId1,
        sparkId2: updatedConnection.sparkId2,
        type: updatedConnection.type,
        metadata: updatedConnection.metadata,
        createdAt: updatedConnection.createdAt
      },
      reason
    })

    return NextResponse.json({
      success: true,
      connection: {
        id: updatedConnection.id,
        sparkId1: updatedConnection.sparkId1,
        sparkId2: updatedConnection.sparkId2,
        type: updatedConnection.type,
        metadata: updatedConnection.metadata,
        createdAt: updatedConnection.createdAt
      }
    })

  } catch (error) {
    console.error("Error updating connection:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request data", details: error.issues }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update connection" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const reasonParam = searchParams.get('reason') ?? undefined

    // Get current connection before deletion
    const currentConnection = await db.sparkConnection.findFirst({
      where: {
        id: params.id,
        OR: [
          { spark1: { userId: session.user.id } },
          { spark2: { userId: session.user.id } }
        ]
      }
    })

    if (!currentConnection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 })
    }

    // Store state for history before deletion
    const beforeState = {
      id: currentConnection.id,
      sparkId1: currentConnection.sparkId1,
      sparkId2: currentConnection.sparkId2,
      type: currentConnection.type,
      metadata: currentConnection.metadata,
      createdAt: currentConnection.createdAt
    }

    // Delete connection
    await db.sparkConnection.delete({
      where: { id: params.id }
    })

    // Record in history
    await connectionHistoryService.recordChange({
      connectionId: currentConnection.id,
      sparkId1: currentConnection.sparkId1,
      sparkId2: currentConnection.sparkId2,
      changeType: ConnectionChangeType.DELETED,
      userId: session.user.id,
      username: session.user.name || session.user.email || 'Unknown User',
      beforeState,
      afterState: null,
      reason: reasonParam
    })

    return NextResponse.json({
      success: true,
      message: "Connection deleted successfully"
    })

  } catch (error) {
    console.error("Error deleting connection:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete connection" },
      { status: 500 }
    )
  }
}
