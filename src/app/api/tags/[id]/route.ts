import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const updateTagSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  parentTagId: z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const tag = await prisma.tag.findUnique({
      where: { id },
      include: {
        parent: true,
        children: {
          include: {
            children: true,
            _count: {
              select: {
                children: true
              }
            }
          }
        },
        _count: {
          select: {
            children: true
          }
        }
      }
    })

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    return NextResponse.json({ tag })
  } catch (error) {
    console.error('Error fetching tag:', error)
    return NextResponse.json({ error: 'Failed to fetch tag' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updateTagSchema.parse(body)

    // Check if tag exists
    const existingTag = await prisma.tag.findUnique({
      where: { id }
    })
    if (!existingTag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    // Check if parent tag exists if provided
    if (validatedData.parentTagId) {
      if (validatedData.parentTagId === id) {
        return NextResponse.json({ error: 'Tag cannot be its own parent' }, { status: 400 })
      }

      const parentTag = await prisma.tag.findUnique({
        where: { id: validatedData.parentTagId }
      })
      if (!parentTag) {
        return NextResponse.json({ error: 'Parent tag not found' }, { status: 400 })
      }

      // Check for circular reference
      const wouldCreateCircle = await checkCircularReference(validatedData.parentTagId, id)
      if (wouldCreateCircle) {
        return NextResponse.json({ error: 'Would create circular reference' }, { status: 400 })
      }
    }

    // Check for duplicate name if name is being updated
    if (validatedData.name && validatedData.name !== existingTag.name) {
      const nameConflict = await prisma.tag.findUnique({
        where: { name: validatedData.name }
      })
      if (nameConflict) {
        return NextResponse.json({ error: 'Tag with this name already exists' }, { status: 400 })
      }
    }

    const tag = await prisma.tag.update({
      where: { id },
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

    return NextResponse.json({ tag })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error updating tag:', error)
    return NextResponse.json({ error: 'Failed to update tag' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Check if tag exists
    const tag = await prisma.tag.findUnique({
      where: { id },
      include: {
        children: true
      }
    })

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    // Update children to have no parent (or handle differently based on requirements)
    await prisma.tag.updateMany({
      where: { parentTagId: id },
      data: { parentTagId: null }
    })

    await prisma.tag.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting tag:', error)
    return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 })
  }
}

async function checkCircularReference(parentId: string, childId: string): Promise<boolean> {
  const visited = new Set<string>()
  
  const checkPath = async (currentId: string): Promise<boolean> => {
    if (currentId === childId) return true
    if (visited.has(currentId)) return false
    
    visited.add(currentId)
    
    const tag = await prisma.tag.findUnique({
      where: { id: currentId },
      select: { parentTagId: true }
    })
    
    if (tag?.parentTagId) {
      return await checkPath(tag.parentTagId)
    }
    
    return false
  }
  
  return await checkPath(parentId)
}