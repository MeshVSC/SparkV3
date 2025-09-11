import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { connectionHistoryService } from "@/lib/connection-history-service"
import { ConnectionType, ConnectionChangeType } from "@prisma/client"
import { z } from "zod"

const createConnectionSchema = z.object({
  sparkId1: z.string(),
  sparkId2: z.string(),
  type: z.nativeEnum(ConnectionType).optional(),
  metadata: z.any().optional(),
  reason: z.string().optional()
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createConnectionSchema.parse(body)
    const { sparkId1, sparkId2, type = ConnectionType.RELATED_TO, metadata, reason } = validatedData

    // Check if both sparks exist and belong to the user
    const [spark1, spark2] = await Promise.all([
      db.spark.findFirst({ where: { id: sparkId1, userId: session.user.id } }),
      db.spark.findFirst({ where: { id: sparkId2, userId: session.user.id } })
    ])

    if (!spark1 || !spark2) {
      return NextResponse.json(
        { error: "One or both sparks not found or don't belong to you" },
        { status: 404 }
      )
    }

    // Check if connection already exists
    const existingConnection = await db.sparkConnection.findFirst({
      where: {
        OR: [
          { sparkId1, sparkId2 },
          { sparkId1: sparkId2, sparkId2: sparkId1 }
        ]
      }
    })

    if (existingConnection) {
      return NextResponse.json(
        { error: "Connection already exists" },
        { status: 409 }
      )
    }

    // Create connection
    const newConnection = await db.sparkConnection.create({
      data: {
        sparkId1,
        sparkId2,
        type,
        metadata
      }
    })

    // Record in history
    await connectionHistoryService.recordChange({
      connectionId: newConnection.id,
      sparkId1,
      sparkId2,
      changeType: ConnectionChangeType.CREATED,
      userId: session.user.id,
      username: session.user.name || session.user.email || 'Unknown User',
      afterState: {
        id: newConnection.id,
        sparkId1: newConnection.sparkId1,
        sparkId2: newConnection.sparkId2,
        type: newConnection.type,
        metadata: newConnection.metadata,
        createdAt: newConnection.createdAt
      },
      reason
    })

    return NextResponse.json({
      success: true,
      connection: {
        id: newConnection.id,
        sparkId1: newConnection.sparkId1,
        sparkId2: newConnection.sparkId2,
        type: newConnection.type,
        metadata: newConnection.metadata,
        createdAt: newConnection.createdAt
      }
    })

  } catch (error) {
    console.error("Error creating connection:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request data", details: error.errors }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create connection" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sparkId = searchParams.get('sparkId')

    let connections
    if (sparkId) {
      // Get connections for a specific spark
      connections = await db.sparkConnection.findMany({
        where: {
          OR: [
            { sparkId1: sparkId },
            { sparkId2: sparkId }
          ],
          AND: {
            OR: [
              { spark1: { userId: session.user.id } },
              { spark2: { userId: session.user.id } }
            ]
          }
        },
        include: {
          spark1: {
            select: { id: true, title: true, color: true, status: true }
          },
          spark2: {
            select: { id: true, title: true, color: true, status: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
    } else {
      // Get all connections for user's sparks
      connections = await db.sparkConnection.findMany({
        where: {
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
        },
        orderBy: { createdAt: 'desc' }
      })
    }

    return NextResponse.json({ connections })

  } catch (error) {
    console.error("Error fetching connections:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch connections" },
      { status: 500 }
    )
  }
}