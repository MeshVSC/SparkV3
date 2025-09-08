import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get total tag count
    const totalTags = await prisma.tag.count()

    // Get root tags count (tags without parent)
    const rootTags = await prisma.tag.count({
      where: {
        parentTagId: null
      }
    })

    // Get tags with children count
    const parentTags = await prisma.tag.count({
      where: {
        children: {
          some: {}
        }
      }
    })

    // Get most used colors
    const colorStats = await prisma.tag.groupBy({
      by: ['color'],
      _count: {
        color: true
      },
      orderBy: {
        _count: {
          color: 'desc'
        }
      },
      take: 5
    })

    // Get deepest hierarchy level
    const allTags = await prisma.tag.findMany({
      include: {
        parent: {
          include: {
            parent: {
              include: {
                parent: {
                  include: {
                    parent: true
                  }
                }
              }
            }
          }
        }
      }
    })

    const maxDepth = allTags.reduce((max, tag) => {
      let depth = 0
      let current = tag
      while (current.parent) {
        depth++
        current = current.parent as any
        if (depth > 10) break // Prevent infinite loop
      }
      return Math.max(max, depth)
    }, 0)

    // Get recent activity (recently created/updated tags)
    const recentTags = await prisma.tag.findMany({
      orderBy: {
        updatedAt: 'desc'
      },
      take: 5,
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return NextResponse.json({
      stats: {
        totalTags,
        rootTags,
        parentTags,
        leafTags: totalTags - parentTags,
        maxDepth,
        colorStats: colorStats.map(stat => ({
          color: stat.color,
          count: stat._count.color
        })),
        recentActivity: recentTags
      }
    })
  } catch (error) {
    console.error('Error fetching tag stats:', error)
    return NextResponse.json({ error: 'Failed to fetch tag stats' }, { status: 500 })
  }
}