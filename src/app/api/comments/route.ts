import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { socketNotificationIntegration } from "@/lib/notification/SocketNotificationIntegration"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const entityId = searchParams.get("entityId")
    const entityType = searchParams.get("entityType")

    if (!entityId || !entityType) {
      return NextResponse.json(
        { error: "Entity ID and type are required" },
        { status: 400 }
      )
    }

    const comments = await db.comment.findMany({
      where: {
        entityId,
        entityType: entityType as any,
        parentId: null, // Only get top-level comments
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
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json(comments)
  } catch (error) {
    console.error("Error fetching comments:", error)
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { content, entityId, entityType, parentId } = await request.json()

    if (!content?.trim() || !entityId || !entityType) {
      return NextResponse.json(
        { error: "Content, entity ID and type are required" },
        { status: 400 }
      )
    }

    // Extract mentions from content
    const mentionRegex = /@(\w+)/g
    const mentions: string[] = []
    let match

    while ((match = mentionRegex.exec(content)) !== null) {
      const username = match[1]
      // Find user by name (you might want to use a more sophisticated matching)
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

    const comment = await db.comment.create({
      data: {
        content: content.trim(),
        authorId: session.user.id,
        entityId,
        entityType,
        parentId,
        mentions: {
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
    socketNotificationIntegration.broadcastToEntity(entityId, entityType, "comment:new", comment)

    // Create notifications for mentioned users
    if (mentions.length > 0) {
      await db.notification.createMany({
        data: mentions.map(userId => ({
          userId,
          type: "COLLABORATION",
          title: "You were mentioned",
          message: `${session.user.name || "Someone"} mentioned you in a comment`,
          relatedEntityId: entityId,
          relatedEntityType: entityType.toLowerCase(),
        })),
      })

      // Notify mentioned users via socket
      mentions.forEach(userId => {
        socketNotificationIntegration.notifyUser(userId, "mention", {
          commentId: comment.id,
          author: comment.author,
          content: comment.content,
          entityId,
          entityType,
        })
      })
    }

    return NextResponse.json(comment)
  } catch (error) {
    console.error("Error creating comment:", error)
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    )
  }
}