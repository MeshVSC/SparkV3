import { z } from 'zod'

export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
export const MAX_SPARKS_COUNT = 10000
export const MAX_TODOS_COUNT = 50000

export const ImportValidationSchema = z.object({
  sparks: z.array(z.object({
    id: z.string().optional(),
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    content: z.string().optional(),
    status: z.enum(['SEEDLING', 'SAPLING', 'TREE', 'FOREST']).optional(),
    level: z.number().int().min(1).max(100).optional(),
    xp: z.number().int().min(0).optional(),
    positionX: z.number().optional(),
    positionY: z.number().optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    tags: z.union([z.array(z.string()), z.string()]).optional(),
    todos: z.array(z.object({
      id: z.string().optional(),
      title: z.string().min(1).max(255),
      description: z.string().optional(),
      completed: z.boolean().optional(),
      type: z.enum(['GENERAL', 'TASK']).optional(),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
      positionX: z.number().optional(),
      positionY: z.number().optional()
    })).optional(),
    attachments: z.array(z.object({
      id: z.string().optional(),
      filename: z.string().min(1),
      url: z.string().url(),
      type: z.enum(['IMAGE', 'FILE', 'LINK']),
      size: z.number().int().min(0).optional()
    })).optional()
  })).max(MAX_SPARKS_COUNT),
  connections: z.array(z.object({
    sparkId1: z.string(),
    sparkId2: z.string(),
    type: z.enum(['DEPENDS_ON', 'RELATED_TO', 'INSPIRES', 'CONFLICTS_WITH']).optional(),
    metadata: z.any().optional()
  })).optional(),
  userPreferences: z.object({
    theme: z.enum(['LIGHT', 'DARK', 'AUTO']).optional(),
    soundEnabled: z.boolean().optional(),
    defaultSparkColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    viewMode: z.enum(['CANVAS', 'KANBAN', 'TIMELINE']).optional()
  }).optional()
})

export const ExportOptionsSchema = z.object({
  includeAttachments: z.boolean().optional().default(false),
  includeTodos: z.boolean().optional().default(true),
  includeConnections: z.boolean().optional().default(true),
  includePreferences: z.boolean().optional().default(true),
  format: z.enum(['json', 'csv']).optional().default('json'),
  sparkIds: z.array(z.string()).optional()
})

export const ImportOptionsSchema = z.object({
  merge: z.boolean().optional().default(false),
  preserveIds: z.boolean().optional().default(false),
  skipInvalid: z.boolean().optional().default(true),
  updateExisting: z.boolean().optional().default(false)
})

export type ImportValidationData = z.infer<typeof ImportValidationSchema>
export type ExportOptions = z.infer<typeof ExportOptionsSchema>
export type ImportOptions = z.infer<typeof ImportOptionsSchema>

export interface ValidationError {
  path: string[]
  message: string
  code: string
}

export interface ValidationResult {
  success: boolean
  data?: ImportValidationData
  errors?: ValidationError[]
  warnings?: string[]
}

export function validateImportData(data: unknown): ValidationResult {
  try {
    const result = ImportValidationSchema.safeParse(data)

    if (!result.success) {
      const errors: ValidationError[] = result.error.issues.map(err => ({
        path: err.path.map(String),
        message: err.message,
        code: err.code
      }))

      return {
        success: false,
        errors
      }
    }

    const warnings: string[] = []

    // Check for potential issues
    if (result.data.sparks.length > 1000) {
      warnings.push(`Large import: ${result.data.sparks.length} sparks. This may take a while.`)
    }

    const totalTodos = result.data.sparks.reduce((sum, spark) => sum + (spark.todos?.length || 0), 0)
    if (totalTodos > MAX_TODOS_COUNT) {
      return {
        success: false,
        errors: [{
          path: ['sparks', 'todos'],
          message: `Too many todos: ${totalTodos}. Maximum allowed: ${MAX_TODOS_COUNT}`,
          code: 'too_many_todos'
        }]
      }
    }

    return {
      success: true,
      data: result.data,
      warnings: warnings.length > 0 ? warnings : undefined
    }
  } catch (error) {
    return {
      success: false,
      errors: [{
        path: [],
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: 'validation_error'
      }]
    }
  }
}

export function validateFileFormat(file: File | Buffer, filename: string): ValidationResult {
  const allowedExtensions = ['.json', '.csv']
  const maxSize = MAX_FILE_SIZE

  // Check file extension
  const extension = filename.toLowerCase().match(/\.[^.]+$/)?.[0]
  if (!extension || !allowedExtensions.includes(extension)) {
    return {
      success: false,
      errors: [{
        path: ['file'],
        message: `Invalid file format. Allowed formats: ${allowedExtensions.join(', ')}`,
        code: 'invalid_file_format'
      }]
    }
  }

  // Check file size
  const size = file instanceof File ? file.size : file.length
  if (size > maxSize) {
    return {
      success: false,
      errors: [{
        path: ['file'],
        message: `File too large: ${(size / 1024 / 1024).toFixed(2)}MB. Maximum: ${maxSize / 1024 / 1024}MB`,
        code: 'file_too_large'
      }]
    }
  }

  return { success: true }
}
