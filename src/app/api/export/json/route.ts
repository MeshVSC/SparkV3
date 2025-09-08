import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { ExportService } from '@/utils/services/ExportService'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Get project name from query parameters
    const { searchParams } = new URL(request.url)
    const projectName = searchParams.get('projectName') || 'Spark Project'

    // Fetch all user data from database
    const [user, sparks, connections, achievements, userPreferences] = await Promise.all([
      db.user.findUnique({
        where: { id: userId }
      }),
      db.spark.findMany({
        where: { userId },
        include: {
          todos: {
            orderBy: { createdAt: 'asc' }
          },
          attachments: {
            orderBy: { createdAt: 'asc' }
          }
        },
        orderBy: { createdAt: 'asc' }
      }),
      db.sparkConnection.findMany({
        where: {
          OR: [
            { spark1: { userId } },
            { spark2: { userId } }
          ]
        },
        include: {
          spark1: { select: { title: true } },
          spark2: { select: { title: true } }
        },
        orderBy: { createdAt: 'asc' }
      }),
      db.userAchievement.findMany({
        where: { userId },
        include: {
          achievement: {
            select: {
              name: true,
              description: true,
              icon: true,
              xpReward: true,
              type: true
            }
          }
        },
        orderBy: { unlockedAt: 'desc' }
      }),
      db.userPreferences.findUnique({
        where: { userId }
      })
    ])

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Calculate project statistics
    const totalTodos = sparks.reduce((sum, spark) => sum + spark.todos.length, 0)
    const completedTodos = sparks.reduce((sum, spark) => 
      sum + spark.todos.filter(todo => todo.completed).length, 0
    )
    const totalAttachments = sparks.reduce((sum, spark) => sum + spark.attachments.length, 0)

    // Prepare data for export
    const projectData = {
      projectName,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        totalXP: user.totalXP,
        level: user.level,
        currentStreak: user.currentStreak,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      },
      sparks: sparks.map(spark => ({
        ...spark,
        tags: spark.tags || null
      })),
      connections,
      achievements: achievements.map(userAch => ({
        ...userAch,
        ...userAch.achievement
      })),
      userPreferences: userPreferences || {},
      statistics: {
        totalSparks: sparks.length,
        totalConnections: connections.length,
        totalTodos,
        completedTodos,
        totalAttachments,
        completionRate: totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0
      },
      metadata: {
        exportGeneratedAt: new Date().toISOString(),
        sparkCanvasVersion: '1.0.0',
        userId
      }
    }

    // Generate JSON export using ExportService
    const exportData = await ExportService.exportToJSON(projectData)

    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
    const filename = `${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_export_${timestamp}.json`

    // Return JSON file as downloadable response
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      }
    })

  } catch (error) {
    console.error('JSON export error:', error)
    
    return NextResponse.json(
      { 
        error: 'Export failed', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { projectName = 'Spark Project', includeAttachments = false } = body

    const userId = session.user.id

    // Fetch data with optional attachment inclusion
    const sparksQuery = {
      where: { userId },
      include: {
        todos: {
          orderBy: { createdAt: 'asc' }
        },
        ...(includeAttachments && {
          attachments: {
            orderBy: { createdAt: 'asc' }
          }
        })
      },
      orderBy: { createdAt: 'asc' }
    }

    const [user, sparks, connections, achievements, userPreferences] = await Promise.all([
      db.user.findUnique({
        where: { id: userId }
      }),
      db.spark.findMany(sparksQuery),
      db.sparkConnection.findMany({
        where: {
          OR: [
            { spark1: { userId } },
            { spark2: { userId } }
          ]
        },
        orderBy: { createdAt: 'asc' }
      }),
      db.userAchievement.findMany({
        where: { userId },
        include: {
          achievement: true
        },
        orderBy: { unlockedAt: 'desc' }
      }),
      db.userPreferences.findUnique({
        where: { userId }
      })
    ])

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Prepare project data
    const projectData = {
      projectName,
      user,
      sparks,
      connections,
      achievements,
      userPreferences: userPreferences || {},
      metadata: {
        includeAttachments,
        exportGeneratedAt: new Date().toISOString()
      }
    }

    // Generate JSON export
    const exportData = await ExportService.exportToJSON(projectData)

    return NextResponse.json({
      success: true,
      data: exportData,
      filename: `${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_export_${new Date().toISOString().split('T')[0]}.json`
    })

  } catch (error) {
    console.error('JSON export error:', error)
    
    return NextResponse.json(
      { 
        error: 'Export failed', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}