import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { WorkspaceRole } from "@prisma/client"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const workspace = await prisma.workspace.findFirst({
      where: {
        id: params.id,
        users: {
          some: {
            userId: session.user.id
          }
        }
      },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true
              }
            }
          }
        }
      }
    })

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    return NextResponse.json(workspace)
  } catch (error) {
    console.error("Error fetching workspace:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { name, description } = await req.json()

    // Check if user has owner or editor permissions
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        workspaceId: params.id,
        userId: session.user.id,
        role: {
          in: [WorkspaceRole.OWNER, WorkspaceRole.EDITOR]
        }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const workspace = await prisma.workspace.update({
      where: { id: params.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null })
      },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true
              }
            }
          }
        }
      }
    })

    // Broadcast workspace update to all members
    const { socketNotificationIntegration } = await import("@/lib/notification/SocketNotificationIntegration")
    socketNotificationIntegration.broadcastToWorkspace(params.id, 'workspace_change', {
      type: 'workspace_updated',
      workspaceId: params.id,
      data: workspace,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json(workspace)
  } catch (error) {
    console.error("Error updating workspace:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is the owner
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        workspaceId: params.id,
        userId: session.user.id,
        role: WorkspaceRole.OWNER
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: "Only workspace owners can delete workspaces" }, { status: 403 })
    }

    await prisma.workspace.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting workspace:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}