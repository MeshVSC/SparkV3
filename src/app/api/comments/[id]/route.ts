import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { socketNotificationIntegration } from "@/lib/notification/SocketNotificationIntegration"

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { content } = await request.json()
    
    if (!content?.trim()) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      )
    }

    // Check if user owns the comment
    const existingComment = await db.comment.findUnique({
      where: { id: params.id },
      select: { authorId: true, entityId: true, entityType: true },
    })

    if (!existingComment || existingComment.authorId !== session.user.id) {
      return NextResponse.json({ error: "Comment not found or unauthorized" }, { status: 404 })
    }

    // Extract mentions from updated content
    const mentionRegex = /@(\w+)/g
    const mentions: string[] = []
    let match

    while ((match = mentionRegex.exec(content)) !== null) {
      const username = match[1]
      const user = await db.user.findFirst({
        where: {
          OR: [
            { name: { equals: username } },
            { email: { contains: username } },
          ],
        },
        select: { id: true },
      })
      
      if (user) {
        mentions.push(user.id)
      }
    }

    // Update comment and mentions
    const updatedComment = await db.comment.update({
      where: { id: params.id },
      data: {
        content: content.trim(),
        editedAt: new Date(),
        mentions: {
          deleteMany: {},
          create: mentions.map(userId => ({ userId })),
        },
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        mentions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        replies: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
            mentions: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    })

    // Emit real-time event
    socketNotificationIntegration.broadcastToEntity(
      existingComment.entityId, 
      existingComment.entityType, 
      "comment:updated", 
      updatedComment
    )

    return NextResponse.json(updatedComment)
  } catch (error) {
    console.error("Error updating comment:", error)
    return NextResponse.json(
      { error: "Failed to update comment" },
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
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user owns the comment
    const existingComment = await db.comment.findUnique({
      where: { id: params.id },
      select: { 
        authorId: true, 
        entityId: true, 
        entityType: true,
        parentId: true 
      },
    })

    if (!existingComment || existingComment.authorId !== session.user.id) {
      return NextResponse.json({ error: "Comment not found or unauthorized" }, { status: 404 })
    }

    // Delete comment and all its replies
    await db.comment.deleteMany({
      where: {
        OR: [
          { id: params.id },
          { parentId: params.id }
        ]
      }
    })

    // Emit real-time event
    socketNotificationIntegration.broadcastToEntity(
      existingComment.entityId, 
      existingComment.entityType, 
      "comment:deleted", 
      { id: params.id }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting comment:", error)
    return NextResponse.json(
      { error: "Failed to delete comment" },
      { status: 500 }
    )
  }
}