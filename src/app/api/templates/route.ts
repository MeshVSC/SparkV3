import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

// Validation schema for template creation/update
const templateSchema = z.object({
  name: z.string().min(1, "Template name is required").max(100, "Template name too long"),
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
  }),
  isPublic: z.boolean().default(false)
})

// GET /api/templates - List user's templates and public templates
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }
    
    const { searchParams } = new URL(request.url)
    const includePublic = searchParams.get('includePublic') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const search = searchParams.get('search')
    
    const skip = (page - 1) * limit
    
    // Build where clause
    const whereClause: any = {
      OR: [
        { userId: session.user.id }, // User's own templates
        ...(includePublic ? [{ isPublic: true }] : []) // Public templates if requested
      ]
    }
    
    // Add search filter if provided
    if (search) {
      whereClause.AND = [
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } }
          ]
        }
      ]
    }
    
    // Get templates with pagination
    const [templates, totalCount] = await Promise.all([
      db.template.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: {
          updatedAt: 'desc'
        },
        skip,
        take: limit
      }),
      db.template.count({ where: whereClause })
    ])
    
    // Calculate metadata for each template
    const templatesWithMetadata = templates.map(template => {
      const templateData = template.templateData as any
      return {
        ...template,
        metadata: {
          sparkCount: templateData?.sparks?.length || 0,
          connectionCount: templateData?.connections?.length || 0,
          totalTodos: templateData?.sparks?.reduce((sum: number, spark: any) => 
            sum + (spark.todos?.length || 0), 0) || 0,
          isOwner: template.userId === session.user.id
        }
      }
    })
    
    return NextResponse.json({
      templates: templatesWithMetadata,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + limit < totalCount
      }
    })
  } catch (error) {
    console.error("Error fetching templates:", error)
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    )
  }
}

// POST /api/templates - Create new template
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    
    // Validate request body
    const validation = templateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: "Invalid template data",
          details: validation.error.issues
        },
        { status: 400 }
      )
    }
    
    const { name, description, templateData, isPublic } = validation.data
    
    // Check for duplicate template names for this user
    const existingTemplate = await db.template.findFirst({
      where: {
        userId: session.user.id,
        name: name
      }
    })
    
    if (existingTemplate) {
      return NextResponse.json(
        { error: "A template with this name already exists" },
        { status: 409 }
      )
    }
    
    // Create the template
    const template = await db.template.create({
      data: {
        name,
        description,
        templateData,
        isPublic,
        userId: session.user.id
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
    
    // Add metadata for response
    const templateWithMetadata = {
      ...template,
      metadata: {
        sparkCount: templateData.sparks?.length || 0,
        connectionCount: templateData.connections?.length || 0,
        totalTodos: templateData.sparks?.reduce((sum: number, spark: any) => 
          sum + (spark.todos?.length || 0), 0) || 0,
        isOwner: true
      }
    }
    
    return NextResponse.json(templateWithMetadata, { status: 201 })
  } catch (error) {
    console.error("Error creating template:", error)
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    )
  }
}