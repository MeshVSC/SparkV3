import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const createTagSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#10b981'),
  parentTagId: z.string().optional(),
})

const updateTagSchema = createTagSchema.partial()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeChildren = searchParams.get('includeChildren') === 'true'

    const tags = await prisma.tag.findMany({
      include: {
        parent: true,
        children: includeChildren ? {
          include: {
            children: true
          }
        } : true,
        _count: {
          select: {
            children: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json({ tags })
  } catch (error) {
    console.error('Error fetching tags:', error)
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createTagSchema.parse(body)

    // Check if parent tag exists if provided
    if (validatedData.parentTagId) {
      const parentTag = await prisma.tag.findUnique({
        where: { id: validatedData.parentTagId }
      })
      if (!parentTag) {
        return NextResponse.json({ error: 'Parent tag not found' }, { status: 400 })
      }
    }

    // Check for duplicate name
    const existingTag = await prisma.tag.findUnique({
      where: { name: validatedData.name }
    })
    if (existingTag) {
      return NextResponse.json({ error: 'Tag with this name already exists' }, { status: 400 })
    }

    const tag = await prisma.tag.create({
      data: validatedData,
      include: {
        parent: true,
        children: true,
        _count: {
          select: {
            children: true
          }
        }
      }
    })

    return NextResponse.json({ tag }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Error creating tag:', error)
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 })
  }
}