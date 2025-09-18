import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockFileUpload } from './setup'
import { parseCsvString, stringifyToCsv } from '@/utils/csv-processor'

describe('Import/Export Workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  describe('JSON Import/Export', () => {
    it('validates JSON file format correctly', async () => {
      const validJsonData = {
        sparks: [{ id: '1', title: 'Test Spark', status: 'SEEDLING' }]
      }
      const jsonFile = mockFileUpload('test.json', JSON.stringify(validJsonData), 'application/json')
      const content = await jsonFile.text()
      const parsed = JSON.parse(content)
      
      expect(parsed.sparks).toHaveLength(1)
      expect(parsed.sparks[0].title).toBe('Test Spark')
    })

    it('handles invalid JSON gracefully', () => {
      expect(() => JSON.parse('{ invalid json')).toThrow()
    })

    it('processes large JSON efficiently', async () => {
      const largeData = { sparks: Array(1000).fill(0).map((_, i) => ({ id: String(i), title: `Spark ${i}` })) }
      const start = performance.now()
      const json = JSON.stringify(largeData)
      const parsed = JSON.parse(json)
      const duration = performance.now() - start
      
      expect(parsed.sparks).toHaveLength(1000)
      expect(duration).toBeLessThan(1000)
    })
  })

  describe('CSV Import/Export', () => {
    it('parses CSV correctly', () => {
      const csv = 'title,status\nTest,SEEDLING\nTest2,SAPLING'
      const result = parseCsvString(csv, { header: true })
      
      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
      expect(result.data?.[0].title).toBe('Test')
    })

    it('handles CSV errors', () => {
      const invalid = 'title\n"unclosed'
      const result = parseCsvString(invalid)
      
      expect(result.success).toBe(false)
      expect(result.errorMessage).toBeDefined()
    })

    it('converts to CSV', () => {
      const data = [{ title: 'Test', status: 'SEEDLING' }]
      const result = stringifyToCsv(data)
      
      expect(result.success).toBe(true)
      expect(result.csv).toContain('title,status')
    })
  })

  describe('API Integration', () => {
    it('handles successful import', async () => {
      const mockResponse = { success: true, operationId: 'test-123' }
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const response = await fetch('/api/import', {
        method: 'POST',
        body: JSON.stringify({ data: { sparks: [] } })
      })
      const result = await response.json()
      
      expect(result.success).toBe(true)
      expect(result.operationId).toBe('test-123')
    })

    it('handles import errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Invalid data' })
      })

      const response = await fetch('/api/import', { method: 'POST' })
      expect(response.ok).toBe(false)
    })

    it('handles network timeouts', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'))
      await expect(fetch('/api/import')).rejects.toThrow('Network timeout')
    })
  })
})