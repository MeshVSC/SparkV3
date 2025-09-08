import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

// Validation schema for template updates
const updateTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required").max(100, "Template name too long").optional(),
  description: z.string().max(500, "Description too long").optional(),
  templateData: z.object({
    version: z.string(),
    sparks: z.array(z.object({
      title: z.string(),
      description: z.string().optional(),
      content: z.string().optional(),
      status: z.enum(['SEEDLING', 'SAPLING', 'TREE', 'FOREST']),
      level: z.number().min(1),
      xp: z.number().min(0),
      color: z.string(),
      tags: z.array(z.string()).optional(),
      position: z.object({
        x: z.number(),
        y: z.number()
      }).optional(),
      todos: z.array(z.object({
        title: z.string(),
        description: z.string().optional(),
        completed: z.boolean(),
        type: z.enum(['GENERAL', 'TASK']),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH'])
      })).optional()
    })),
    connections: z.array(z.object({
      spark1Index: z.number(),
      spark2Index: z.number(),
      type: z.enum(['DEPENDS_ON', 'RELATED_TO', 'INSPIRES', 'CONFLICTS_WITH'])
    })).optional(),
    preferences: z.object({}).optional(),
    metadata: z.object({}).optional()
  }).optional(),
  isPublic: z.boolean().optional()
})

// GET /api/templates/[id] - Get specific template
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }
    
    const templateId = params.id
    
    // Find template - user can access their own templates or public templates
    const template = await db.template.findFirst({
      where: {
        id: templateId,
        OR: [
          { userId: session.user.id }, // User's own template
          { isPublic: true } // Public template
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })
    
    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      )
    }
    
    // Add metadata
    const templateData = template.templateData as any
    const templateWithMetadata = {
      ...template,
      metadata: {
        sparkCount: templateData?.sparks?.length || 0,
        connectionCount: templateData?.connections?.length || 0,
        totalTodos: templateData?.sparks?.reduce((sum: number, spark: any) => 
          sum + (spark.todos?.length || 0), 0) || 0,
        isOwner: template.userId === session.user.id
      }
    }
    
    return NextResponse.json(templateWithMetadata)
  } catch (error) {
    console.error("Error fetching template:", error)
    return NextResponse.json(
      { error: "Failed to fetch template" },
      { status: 500 }
    )
  }
}

// PUT /api/templates/[id] - Update template
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }
    
    const templateId = params.id
    
    // Check if template exists and user owns it
    const existingTemplate = await db.template.findFirst({
      where: {
        id: templateId,
        userId: session.user.id // Only owner can update
      }
    })
    
    if (!existingTemplate) {
      return NextResponse.json(
        { error: "Template not found or access denied" },
        { status: 404 }
      )
    }
    
    const body = await request.json()
    
    // Validate request body
    const validation = updateTemplateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: "Invalid template data",
          details: validation.error.issues
        },
        { status: 400 }
      )
    }
    
    const updateData = validation.data
    
    // Check for duplicate name if name is being updated
    if (updateData.name && updateData.name !== existingTemplate.name) {
      const duplicateTemplate = await db.template.findFirst({
        where: {
          userId: session.user.id,
          name: updateData.name,
          id: { not: templateId }
        }
      })
      
      if (duplicateTemplate) {
        return NextResponse.json(
          { error: "A template with this name already exists" },
          { status: 409 }
        )
      }
    }
    
    // Update the template
    const updatedTemplate = await db.template.update({
      where: { id: templateId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })
    
    // Add metadata
    const templateData = updatedTemplate.templateData as any
    const templateWithMetadata = {
      ...updatedTemplate,
      metadata: {
        sparkCount: templateData?.sparks?.length || 0,
        connectionCount: templateData?.connections?.length || 0,
        totalTodos: templateData?.sparks?.reduce((sum: number, spark: any) => 
          sum + (spark.todos?.length || 0), 0) || 0,
        isOwner: true
      }
    }
    
    return NextResponse.json(templateWithMetadata)
  } catch (error) {
    console.error("Error updating template:", error)
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    )
  }
}

// DELETE /api/templates/[id] - Delete template
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }
    
    const templateId = params.id
    
    // Check if template exists and user owns it
    const existingTemplate = await db.template.findFirst({
      where: {
        id: templateId,
        userId: session.user.id // Only owner can delete
      }
    })
    
    if (!existingTemplate) {
      return NextResponse.json(
        { error: "Template not found or access denied" },
        { status: 404 }
      )
    }
    
    // Delete the template
    await db.template.delete({
      where: { id: templateId }
    })
    
    return NextResponse.json(
      { message: "Template deleted successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error deleting template:", error)
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    )
  }
}