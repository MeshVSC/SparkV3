/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest'
import { GET } from '@/app/api/health/route'

describe('/api/health', () => {
  it('should return health check response', async () => {
    const request = new Request('http://localhost:3000/api/health')
    const response = await GET()
    
    expect(response.status).toBe(200)
    
    const data = await response.json()
    expect(data).toEqual({ message: 'Good!' })
  })
})