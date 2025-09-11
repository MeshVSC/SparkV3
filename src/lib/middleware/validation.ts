import { NextRequest } from 'next/server'
import { 
  ValidationResult, 
  ValidationError, 
  validateFileFormat, 
  MAX_FILE_SIZE 
} from '@/lib/validation/import-export'

export interface RequestValidationOptions {
  maxFileSize?: number
  allowedFormats?: string[]
  requireAuth?: boolean
  maxRequestSize?: number
}

export class RequestValidationMiddleware {
  static async validateRequest(
    request: NextRequest, 
    options: RequestValidationOptions = {}
  ): Promise<ValidationResult> {
    const {
      maxFileSize = MAX_FILE_SIZE,
      allowedFormats = ['.json', '.csv'],
      maxRequestSize = 100 * 1024 * 1024 // 100MB for request body
    } = options

    try {
      // Check Content-Length header if available
      const contentLength = request.headers.get('content-length')
      if (contentLength && parseInt(contentLength) > maxRequestSize) {
        return {
          success: false,
          errors: [{
            path: ['request'],
            message: `Request too large: ${(parseInt(contentLength) / 1024 / 1024).toFixed(2)}MB. Maximum: ${maxRequestSize / 1024 / 1024}MB`,
            code: 'request_too_large'
          }]
        }
      }

      const contentType = request.headers.get('content-type') || ''

      if (contentType.includes('multipart/form-data')) {
        // For file uploads, we can't fully validate without parsing the form data
        // This will be done in the route handler
        return { success: true }
      }

      if (contentType.includes('application/json')) {
        // Basic JSON validation can be done here if needed
        try {
          const body = await request.clone().json()
          
          // Check for basic structure if it's an import request
          if (request.url.includes('/api/import') && body.data) {
            if (!body.data.sparks || !Array.isArray(body.data.sparks)) {
              return {
                success: false,
                errors: [{
                  path: ['data', 'sparks'],
                  message: 'Import data must contain a "sparks" array',
                  code: 'missing_sparks_array'
                }]
              }
            }
          }
        } catch (error) {
          return {
            success: false,
            errors: [{
              path: ['request', 'body'],
              message: 'Invalid JSON in request body',
              code: 'invalid_json'
            }]
          }
        }
      }

      return { success: true }

    } catch (error) {
      return {
        success: false,
        errors: [{
          path: ['request'],
          message: `Request validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'validation_error'
        }]
      }
    }
  }

  static async validateFileUpload(
    file: File, 
    options: RequestValidationOptions = {}
  ): Promise<ValidationResult> {
    const {
      maxFileSize = MAX_FILE_SIZE,
      allowedFormats = ['.json', '.csv']
    } = options

    // Basic file validation
    if (!file) {
      return {
        success: false,
        errors: [{
          path: ['file'],
          message: 'No file provided',
          code: 'missing_file'
        }]
      }
    }

    // File name validation
    if (!file.name || file.name.trim() === '') {
      return {
        success: false,
        errors: [{
          path: ['file', 'name'],
          message: 'File must have a valid name',
          code: 'invalid_filename'
        }]
      }
    }

    // Use existing file format validation
    return validateFileFormat(file, file.name)
  }

  static createErrorResponse(errors: ValidationError[], statusCode = 400) {
    return {
      error: 'Validation failed',
      details: errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      })),
      validationErrors: errors
    }
  }

  static createRateLimitResponse(resetTime?: number) {
    return {
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.',
      resetTime: resetTime || Date.now() + 60000 // 1 minute default
    }
  }

  static createSizeErrorResponse(actualSize: number, maxSize: number) {
    return {
      error: 'Content too large',
      message: `Content size ${(actualSize / 1024 / 1024).toFixed(2)}MB exceeds maximum of ${maxSize / 1024 / 1024}MB`,
      actualSize,
      maxSize
    }
  }
}

// Security headers middleware
export function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers)
  
  // Add security headers
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('X-XSS-Protection', '1; mode=block')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';")
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

// Rate limiting utility (simple in-memory implementation)
class SimpleRateLimit {
  private requests = new Map<string, { count: number; resetTime: number }>()
  private maxRequests: number
  private windowMs: number

  constructor(maxRequests = 100, windowMs = 15 * 60 * 1000) { // 100 requests per 15 minutes
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }

  isLimited(identifier: string): { limited: boolean; resetTime?: number } {
    const now = Date.now()
    const record = this.requests.get(identifier)

    // Clean up expired records periodically
    if (Math.random() < 0.01) { // 1% chance to clean up
      this.cleanup()
    }

    if (!record || now > record.resetTime) {
      // New window or expired record
      this.requests.set(identifier, { count: 1, resetTime: now + this.windowMs })
      return { limited: false }
    }

    if (record.count >= this.maxRequests) {
      return { limited: true, resetTime: record.resetTime }
    }

    record.count++
    return { limited: false }
  }

  private cleanup() {
    const now = Date.now()
    for (const [key, record] of this.requests.entries()) {
      if (now > record.resetTime) {
        this.requests.delete(key)
      }
    }
  }
}

export const rateLimiter = new SimpleRateLimit()

// Helper to get client identifier for rate limiting
export function getClientIdentifier(request: NextRequest): string {
  // Try to get IP from various headers
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const ip = forwarded?.split(',')[0] || realIP || 'unknown'
  
  // For authenticated requests, use user ID if available
  const authHeader = request.headers.get('authorization')
  if (authHeader) {
    // This is a simplified approach - in practice you'd decode the token
    return `auth_${authHeader.slice(0, 20)}`
  }
  
  return `ip_${ip}`
}