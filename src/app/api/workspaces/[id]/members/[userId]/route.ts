import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { WorkspaceRole } from "@prisma/client"
import { socketNotificationIntegration } from "@/lib/notification/SocketNotificationIntegration"

export async function PUT(req: NextRequest, { params }: { params: { id: string; userId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { role } = await req.json()

    if (!Object.values(WorkspaceRole).includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    // Check if current user has permission to change roles
    const currentUserWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        workspaceId: params.id,
        userId: session.user.id
      }
    })

    if (!currentUserWorkspace || currentUserWorkspace.role === WorkspaceRole.VIEWER) {
      return NextResponse.json({ error: "Insufficient permissions to modify member roles" }, { status: 403 })
    }

    // Check if target member exists
    const targetMember = await prisma.userWorkspace.findFirst({
      where: {
        workspaceId: params.id,
        userId: params.userId
      },
      include: {
        user: {
          select: { name: true, email: true }
        },
        workspace: {
          select: { name: true }
        }
      }
    })

    if (!targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    // Prevent non-owners from changing owner roles or making someone an owner
    if (currentUserWorkspace.role !== WorkspaceRole.OWNER) {
      if (targetMember.role === WorkspaceRole.OWNER || role === WorkspaceRole.OWNER) {
        return NextResponse.json({ error: "Only workspace owners can modify owner roles" }, { status: 403 })
      }
    }

    // Update the member's role
    const updatedMember = await prisma.userWorkspace.update({
      where: {
        id: targetMember.id
      },
      data: {
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
        }
      }
    })

    // Notify the user whose role was changed
    if (params.userId !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: params.userId,
          type: 'COLLABORATION',
          title: 'Role Updated',
          message: `Your role in "${targetMember.workspace.name}" has been updated to ${role.toLowerCase()}`,
          relatedEntityId: params.id,
          relatedEntityType: 'workspace'
        }
      })

      socketNotificationIntegration.notifyUser(params.userId, 'role_updated', {
        workspaceId: params.id,
        workspaceName: targetMember.workspace.name,
        newRole: role,
        updatedBy: session.user.name || session.user.email
      })
    }

    // Broadcast workspace change to all members
    socketNotificationIntegration.broadcastToWorkspace(params.id, 'workspace_change', {
      type: 'member_role_updated',
      workspaceId: params.id,
      data: { userId: params.userId, role },
      timestamp: new Date().toISOString()
    })

    return NextResponse.json(updatedMember)
  } catch (error) {
    console.error("Error updating member role:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; userId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if current user has permission to remove members
    const currentUserWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        workspaceId: params.id,
        userId: session.user.id
      }
    })

    if (!currentUserWorkspace) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Find target member
    const targetMember = await prisma.userWorkspace.findFirst({
      where: {
        workspaceId: params.id,
        userId: params.userId
      },
      include: {
        user: {
          select: { name: true, email: true }
        },
        workspace: {
          select: { name: true }
        }
      }
    })

    if (!targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    // Users can remove themselves
    // Owners can remove anyone
    // Editors can remove viewers
    const canRemove = session.user.id === params.userId ||
      currentUserWorkspace.role === WorkspaceRole.OWNER ||
      (currentUserWorkspace.role === WorkspaceRole.EDITOR && targetMember.role === WorkspaceRole.VIEWER)

    if (!canRemove) {
      return NextResponse.json({ error: "Insufficient permissions to remove this member" }, { status: 403 })
    }

    // Prevent removing the last owner
    if (targetMember.role === WorkspaceRole.OWNER) {
      const ownerCount = await prisma.userWorkspace.count({
        where: {
          workspaceId: params.id,
          role: WorkspaceRole.OWNER
        }
      })

      if (ownerCount <= 1) {
        return NextResponse.json({ error: "Cannot remove the last owner of the workspace" }, { status: 400 })
      }
    }

    // Remove the member
    await prisma.userWorkspace.delete({
      where: {
        id: targetMember.id
      }
    })

    // Notify the removed user (unless they removed themselves)
    if (params.userId !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: params.userId,
          type: 'COLLABORATION',
          title: 'Removed from Workspace',
          message: `You have been removed from the workspace "${targetMember.workspace.name}"`,
          relatedEntityId: params.id,
          relatedEntityType: 'workspace'
        }
      })

      socketNotificationIntegration.notifyUser(params.userId, 'workspace_removed', {
        workspaceId: params.id,
        workspaceName: targetMember.workspace.name,
        removedBy: session.user.name || session.user.email
      })
    }

    // Broadcast workspace change to all members
    socketNotificationIntegration.broadcastToWorkspace(params.id, 'workspace_change', {
      type: 'member_removed',
      workspaceId: params.id,
      data: { userId: params.userId },
      timestamp: new Date().toISOString()
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error removing member:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}