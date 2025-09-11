import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { BulkOperationsService } from '@/lib/services/bulk-operations'
import {
  validateImportData,
  validateFileFormat,
  ImportOptionsSchema,
  MAX_FILE_SIZE
} from '@/lib/validation/import-export'
import {
  RequestValidationMiddleware,
  rateLimiter,
  getClientIdentifier,
  addSecurityHeaders
} from '@/lib/middleware/validation'
import { v4 as uuidv4 } from 'uuid'
import Papa from 'papaparse'

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

    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      const response = NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
      return addSecurityHeaders(response)
    }

    const userId = session.user.id
    const contentType = request.headers.get('content-type') || ''

    let importData: any
    let filename = 'import.json'
    let options: any = {}
    let socketId: string | undefined

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData()
      const file = formData.get('file') as File
      const optionsJson = formData.get('options') as string
      socketId = formData.get('socketId') as string | undefined

      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        )
      }

      filename = file.name

      // Validate file format and size
      const fileValidation = await RequestValidationMiddleware.validateFileUpload(file)
      if (!fileValidation.success) {
        const response = NextResponse.json(
          {
            error: 'Invalid file',
            details: fileValidation.errors?.[0]?.message || 'File validation failed',
            validationErrors: fileValidation.errors
          },
          { status: 400 }
        )
        return addSecurityHeaders(response)
      }

      // Parse options
      if (optionsJson) {
        try {
          options = JSON.parse(optionsJson)
        } catch {
          return NextResponse.json(
            { error: 'Invalid options JSON' },
            { status: 400 }
          )
        }
      }

      // Read file content
      const fileContent = await file.text()

      // Parse based on file extension
      if (filename.toLowerCase().endsWith('.json')) {
        try {
          importData = JSON.parse(fileContent)
        } catch (error) {
          return NextResponse.json(
            {
              error: 'Invalid JSON file',
              details: 'The uploaded file contains invalid JSON syntax'
            },
            { status: 400 }
          )
        }
      } else if (filename.toLowerCase().endsWith('.csv')) {
        // Parse CSV and convert to import format
        try {
          const parsed = Papa.parse(fileContent, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header: string) => header.trim()
          })

          if (parsed.errors.length > 0) {
            return NextResponse.json(
              {
                error: 'CSV parsing failed',
                details: parsed.errors.map(err => err.message).join(', ')
              },
              { status: 400 }
            )
          }

          // Convert CSV to spark import format
          importData = {
            sparks: parsed.data.map((row: any) => ({
              title: row.title || 'Untitled',
              description: row.description || null,
              content: row.content || null,
              status: ['SEEDLING', 'SAPLING', 'TREE', 'FOREST'].includes(row.status?.toUpperCase())
                ? row.status.toUpperCase()
                : 'SEEDLING',
              level: parseInt(row.level) || 1,
              xp: parseInt(row.xp) || 0,
              positionX: row.positionX ? parseFloat(row.positionX) : null,
              positionY: row.positionY ? parseFloat(row.positionY) : null,
              color: row.color?.match(/^#[0-9A-Fa-f]{6}$/) ? row.color : '#10b981',
              tags: row.tags ? row.tags.split(',').map((tag: string) => tag.trim()) : []
            })).filter((spark: any) => spark.title && spark.title.trim())
          }
        } catch (error) {
          return NextResponse.json(
            {
              error: 'CSV processing failed',
              details: error instanceof Error ? error.message : 'Unknown CSV error'
            },
            { status: 400 }
          )
        }
      }

    } else if (contentType.includes('application/json')) {
      // Handle JSON payload
      const body = await request.json()
      importData = body.data
      options = body.options || {}
      socketId = body.socketId
      filename = body.filename || 'import.json'

    } else {
      return NextResponse.json(
        { error: 'Unsupported content type. Use multipart/form-data or application/json' },
        { status: 400 }
      )
    }

    // Validate import options
    const optionsValidation = ImportOptionsSchema.safeParse(options)
    if (!optionsValidation.success) {
      return NextResponse.json(
        {
          error: 'Invalid import options',
          details: optionsValidation.error.issues.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      )
    }

    const validatedOptions = optionsValidation.data

    // Validate import data structure
    const dataValidation = validateImportData(importData)
    if (!dataValidation.success) {
      return NextResponse.json(
        {
          error: 'Invalid import data structure',
          details: 'The provided data does not match the expected format',
          validationErrors: dataValidation.errors,
          suggestions: [
            'Ensure the data contains a "sparks" array',
            'Check that each spark has at least a "title" field',
            'Verify that all field types match the expected schema',
            'Make sure IDs are valid strings if preserveIds is enabled'
          ]
        },
        { status: 400 }
      )
    }

    const validatedData = dataValidation.data!
    const operationId = uuidv4()

    // Check if this is a large import that should be processed asynchronously
    const totalItems = validatedData.sparks.length +
      validatedData.sparks.reduce((sum, spark) => sum + (spark.todos?.length || 0), 0) +
      (validatedData.connections?.length || 0)

    if (totalItems > 500 || socketId) {
      // Process asynchronously with WebSocket updates
      setTimeout(async () => {
        await bulkOpsService.importData(
          userId,
          validatedData,
          validatedOptions,
          socketId,
          operationId
        )
      }, 0)

      return NextResponse.json({
        success: true,
        operationId,
        message: 'Import started. You will receive real-time updates via WebSocket.',
        async: true,
        warnings: dataValidation.warnings,
        preview: {
          sparks: validatedData.sparks.length,
          todos: validatedData.sparks.reduce((sum, spark) => sum + (spark.todos?.length || 0), 0),
          connections: validatedData.connections?.length || 0
        }
      })
    }

    // Process synchronously for smaller imports
    const result = await bulkOpsService.importData(
      userId,
      validatedData,
      validatedOptions,
      socketId,
      operationId
    )

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Import failed',
          details: result.errors?.[0]?.message || 'Unknown error',
          operationId,
          validationErrors: result.errors
        },
        { status: 500 }
      )
    }

    const response = NextResponse.json({
      success: true,
      operationId,
      message: 'Import completed successfully',
      imported: result.imported,
      duration: result.duration,
      warnings: result.warnings || dataValidation.warnings
    })

    return addSecurityHeaders(response)

  } catch (error) {
    console.error('Import API error:', error)

    // Check for specific error types
    if (error instanceof Error && error.message.includes('File too large')) {
      const response = NextResponse.json(
        {
          error: 'File too large',
          details: `Maximum file size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
        },
        { status: 413 }
      )
      return addSecurityHeaders(response)
    }

    const response = NextResponse.json(
      {
        error: 'Import failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )

    return addSecurityHeaders(response)
  }
}

// GET endpoint to check import status
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
    const operationId = searchParams.get('operationId')

    if (!operationId) {
      return NextResponse.json(
        { error: 'Operation ID required' },
        { status: 400 }
      )
    }

    const isActive = bulkOpsService.isOperationActive(operationId)

    const response = NextResponse.json({
      operationId,
      active: isActive,
      message: isActive ? 'Operation is still running' : 'Operation completed or not found'
    })

    return addSecurityHeaders(response)

  } catch (error) {
    console.error('Import status API error:', error)

    const response = NextResponse.json(
      {
        error: 'Status check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )

    return addSecurityHeaders(response)
  }
}

// DELETE endpoint to cancel an import
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      const response = NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
      return addSecurityHeaders(response)
    }

    const { searchParams } = new URL(request.url)
    const operationId = searchParams.get('operationId')

    if (!operationId) {
      return NextResponse.json(
        { error: 'Operation ID required' },
        { status: 400 }
      )
    }

    const cancelled = bulkOpsService.cancelOperation(operationId)

    const response = NextResponse.json({
      success: cancelled,
      operationId,
      message: cancelled ? 'Operation cancelled successfully' : 'Operation not found or already completed'
    })

    return addSecurityHeaders(response)

  } catch (error) {
    console.error('Import cancel API error:', error)

    const response = NextResponse.json(
      {
        error: 'Cancel failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )

    return addSecurityHeaders(response)
  }
}
