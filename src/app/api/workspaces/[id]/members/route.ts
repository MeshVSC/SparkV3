import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { WorkspaceRole } from "@prisma/client"
import { socketNotificationIntegration } from "@/lib/notification/SocketNotificationIntegration"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { email, role = WorkspaceRole.VIEWER } = await req.json()

    if (!email?.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    // Check if user has permission to invite (owner or editor)
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
      return NextResponse.json({ error: "Insufficient permissions to invite members" }, { status: 403 })
    }

    // Find user by email
    const targetUser = await prisma.user.findUnique({
      where: { email: email.trim() }
    })

    if (!targetUser) {
      return NextResponse.json({ error: "User not found with this email address" }, { status: 404 })
    }

    // Check if user is already a member
    const existingMember = await prisma.userWorkspace.findFirst({
      where: {
        workspaceId: params.id,
        userId: targetUser.id
      }
    })

    if (existingMember) {
      return NextResponse.json({ error: "User is already a member of this workspace" }, { status: 400 })
    }

    // Add user to workspace
    const newMember = await prisma.userWorkspace.create({
      data: {
        workspaceId: params.id,
        userId: targetUser.id,
        role
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true
          }
        },
        workspace: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    // Send notification to the invited user
    await prisma.notification.create({
      data: {
        userId: targetUser.id,
        type: 'COLLABORATION',
        title: 'Workspace Invitation',
        message: `You have been invited to join the workspace "${newMember.workspace.name}"`,
        relatedEntityId: params.id,
        relatedEntityType: 'workspace'
      }
    })

    // Broadcast real-time notification
    socketNotificationIntegration.notifyUser(targetUser.id, 'workspace_invitation', {
      workspaceId: params.id,
      workspaceName: newMember.workspace.name,
      invitedBy: session.user.name || session.user.email,
      role
    })

    // Broadcast workspace change to all members
    socketNotificationIntegration.broadcastToWorkspace(params.id, 'workspace_change', {
      type: 'member_invited',
      workspaceId: params.id,
      data: newMember,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json(newMember)
  } catch (error) {
    console.error("Error inviting member:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is a member of the workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        workspaceId: params.id,
        userId: session.user.id
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const members = await prisma.userWorkspace.findMany({
      where: {
        workspaceId: params.id
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true
          }
        }
      },
      orderBy: [
        { role: 'asc' },
        { createdAt: 'asc' }
      ]
    })

    return NextResponse.json(members)
  } catch (error) {
    console.error("Error fetching members:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}