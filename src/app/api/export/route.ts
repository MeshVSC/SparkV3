import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { BulkOperationsService } from '@/lib/services/bulk-operations'
import { ExportOptionsSchema } from '@/lib/validation/import-export'
import { 
  RequestValidationMiddleware,
  rateLimiter,
  getClientIdentifier,
  addSecurityHeaders
} from '@/lib/middleware/validation'
import { v4 as uuidv4 } from 'uuid'

// Initialize the bulk operations service
const bulkOpsService = new BulkOperationsService()

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request)
    const rateLimitResult = rateLimiter.isLimited(clientId)
    
    if (rateLimitResult.limited) {
      const response = NextResponse.json(
        RequestValidationMiddleware.createRateLimitResponse(rateLimitResult.resetTime),
        { status: 429 }
      )
      return addSecurityHeaders(response)
    }

    // Request validation
    const validationResult = await RequestValidationMiddleware.validateRequest(request)
    if (!validationResult.success) {
      const response = NextResponse.json(
        RequestValidationMiddleware.createErrorResponse(validationResult.errors!),
        { status: 400 }
      )
      return addSecurityHeaders(response)
    }

    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      const response = NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
      return addSecurityHeaders(response)
    }

    const body = await request.json()
    const validation = ExportOptionsSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid export options',
          details: validation.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      )
    }

    const options = validation.data
    const userId = session.user.id
    const operationId = uuidv4()
    const socketId = body.socketId as string | undefined

    // Validate sparkIds if provided
    if (options.sparkIds && options.sparkIds.length > 0) {
      const { db } = await import('@/lib/db')
      const userSparks = await db.spark.findMany({
        where: { userId, id: { in: options.sparkIds } },
        select: { id: true }
      })

      const invalidIds = options.sparkIds.filter(id => 
        !userSparks.some(spark => spark.id === id)
      )

      if (invalidIds.length > 0) {
        return NextResponse.json(
          { 
            error: 'Invalid spark IDs',
            details: `The following spark IDs do not exist or do not belong to you: ${invalidIds.join(', ')}`
          },
          { status: 400 }
        )
      }
    }

    // For large exports, process asynchronously
    if ((!options.sparkIds || options.sparkIds.length > 100)) {
      // Start async export
      setTimeout(async () => {
        await bulkOpsService.exportData(
          userId,
          {
            sparkIds: options.sparkIds,
            includeAttachments: options.includeAttachments
          },
          socketId,
          operationId
        )
      }, 0)

      return NextResponse.json({
        success: true,
        operationId,
        message: 'Export started. You will receive real-time updates via WebSocket.',
        async: true
      })
    }

    // For small exports, process synchronously
    const result = await bulkOpsService.exportData(
      userId,
      {
        sparkIds: options.sparkIds,
        includeAttachments: options.includeAttachments
      },
      socketId,
      operationId
    )

    if (!result.success) {
      return NextResponse.json(
        { 
          error: 'Export failed',
          details: result.errors?.[0]?.message || 'Unknown error',
          operationId
        },
        { status: 500 }
      )
    }

    // Return data for synchronous exports
    const filename = `spark_export_${new Date().toISOString().split('T')[0]}.json`
    
    const response = NextResponse.json({
      success: true,
      operationId,
      data: result.data,
      filename,
      statistics: {
        exported: result.exported,
        duration: result.duration
      }
    })
    
    return addSecurityHeaders(response)

  } catch (error) {
    console.error('Export API error:', error)
    
    const response = NextResponse.json(
      { 
        error: 'Export failed', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
    
    return addSecurityHeaders(response)
  }
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request)
    const rateLimitResult = rateLimiter.isLimited(clientId)
    
    if (rateLimitResult.limited) {
      const response = NextResponse.json(
        RequestValidationMiddleware.createRateLimitResponse(rateLimitResult.resetTime),
        { status: 429 }
      )
      return addSecurityHeaders(response)
    }

    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      const response = NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
      return addSecurityHeaders(response)
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'
    const includeAttachments = searchParams.get('includeAttachments') === 'true'
    const sparkIds = searchParams.get('sparkIds')?.split(',').filter(Boolean)

    if (format !== 'json' && format !== 'csv') {
      return NextResponse.json(
        { error: 'Invalid format. Supported formats: json, csv' },
        { status: 400 }
      )
    }

    const userId = session.user.id
    const operationId = uuidv4()

    const result = await bulkOpsService.exportData(
      userId,
      { sparkIds, includeAttachments },
      undefined, // No socket for GET requests
      operationId
    )

    if (!result.success) {
      return NextResponse.json(
        { 
          error: 'Export failed',
          details: result.errors?.[0]?.message || 'Unknown error'
        },
        { status: 500 }
      )
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
    let filename: string
    let contentType: string
    let responseBody: string

    if (format === 'csv') {
      // Convert to CSV format
      const { ExportService } = await import('@/utils/services/ExportService.js')
      const csvData = await ExportService.exportSparksToCSV(result.data?.sparks || [])
      
      filename = `spark_export_${timestamp}.csv`
      contentType = 'text/csv'
      responseBody = csvData
    } else {
      filename = `spark_export_${timestamp}.json`
      contentType = 'application/json'
      responseBody = JSON.stringify(result.data, null, 2)
    }

    const response = new NextResponse(responseBody, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      }
    })

    return addSecurityHeaders(response)

  } catch (error) {
    console.error('Export API error:', error)
    
    const response = NextResponse.json(
      { 
        error: 'Export failed', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
    
    return addSecurityHeaders(response)
  }
}