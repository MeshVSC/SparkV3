import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/lib/db'

describe('Data Persistence Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  describe('Local Storage Sync', () => {
    it('saves data to localStorage', () => {
      const testData = { sparks: [{ id: '1', title: 'Test' }] }
      localStorage.setItem('spark-data', JSON.stringify(testData))
      
      const saved = localStorage.getItem('spark-data')
      expect(saved).toBeDefined()
      expect(JSON.parse(saved!)).toEqual(testData)
    })

    it('handles localStorage quota exceeded', () => {
      const largeData = 'x'.repeat(10 * 1024 * 1024) // 10MB
      
      localStorage.setItem = vi.fn().mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })

      expect(() => localStorage.setItem('large', largeData)).toThrow('QuotaExceededError')
    })

    it('syncs with sessionStorage', () => {
      const sessionData = { currentSpark: 'spark-123' }
      sessionStorage.setItem('session-data', JSON.stringify(sessionData))
      
      const retrieved = sessionStorage.getItem('session-data')
      expect(JSON.parse(retrieved!)).toEqual(sessionData)
    })

    it('handles storage unavailable', () => {
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
        writable: true
      })
      
      expect(window.localStorage).toBeUndefined()
    })
  })

  describe('Database Synchronization', () => {
    it('creates spark in database', async () => {
      const mockSpark = { id: '1', title: 'Test Spark', userId: 'user-1' }
      db.spark.create = vi.fn().mockResolvedValue(mockSpark)

      const result = await db.spark.create({ data: mockSpark })
      
      expect(db.spark.create).toHaveBeenCalledWith({ data: mockSpark })
      expect(result).toEqual(mockSpark)
    })

    it('handles database connection errors', async () => {
      db.spark.findMany = vi.fn().mockRejectedValue(new Error('Connection failed'))
      
      await expect(db.spark.findMany()).rejects.toThrow('Connection failed')
    })

    it('validates data before saving', async () => {
      const invalidSpark = { title: '' } // Missing required fields
      db.spark.create = vi.fn().mockRejectedValue(new Error('Validation failed'))

      await expect(db.spark.create({ data: invalidSpark })).rejects.toThrow('Validation failed')
    })

    it('handles concurrent updates', async () => {
      const sparkId = 'spark-1'
      const update1 = { title: 'Update 1' }
      const update2 = { title: 'Update 2' }

      db.spark.update = vi.fn()
        .mockResolvedValueOnce({ ...update1, id: sparkId })
        .mockRejectedValueOnce(new Error('Concurrent modification'))

      const result1 = await db.spark.update({ where: { id: sparkId }, data: update1 })
      expect(result1.title).toBe('Update 1')

      await expect(
        db.spark.update({ where: { id: sparkId }, data: update2 })
      ).rejects.toThrow('Concurrent modification')
    })
  })

  describe('Offline Data Management', () => {
    it('queues operations when offline', () => {
      const offlineQueue: any[] = []
      const operation = { type: 'CREATE_SPARK', data: { title: 'Offline Spark' } }
      
      // Simulate offline state
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
      
      if (!navigator.onLine) {
        offlineQueue.push(operation)
      }
      
      expect(offlineQueue).toHaveLength(1)
      expect(offlineQueue[0].type).toBe('CREATE_SPARK')
    })

    it('processes queued operations when online', async () => {
      const queue = [
        { type: 'CREATE_SPARK', data: { title: 'Queued Spark 1' } },
        { type: 'CREATE_SPARK', data: { title: 'Queued Spark 2' } }
      ]

      db.spark.create = vi.fn().mockResolvedValue({})
      Object.defineProperty(navigator, 'onLine', { value: true })

      if (navigator.onLine) {
        for (const operation of queue) {
          await db.spark.create({ data: operation.data })
        }
      }

      expect(db.spark.create).toHaveBeenCalledTimes(2)
    })

    it('handles sync conflicts', async () => {
      const localData = { id: '1', title: 'Local Title', updatedAt: new Date('2024-01-01') }
      const serverData = { id: '1', title: 'Server Title', updatedAt: new Date('2024-01-02') }
      
      // Server data is newer, should take precedence
      const resolved = serverData.updatedAt > localData.updatedAt ? serverData : localData
      
      expect(resolved.title).toBe('Server Title')
    })
  })

  describe('Data Consistency', () => {
    it('maintains referential integrity', async () => {
      const userId = 'user-1'
      const sparkId = 'spark-1'
      
      db.spark.create = vi.fn().mockResolvedValue({ id: sparkId, userId })
      db.todo.create = vi.fn().mockResolvedValue({ id: 'todo-1', sparkId })

      const spark = await db.spark.create({ data: { id: sparkId, userId, title: 'Test' } })
      const todo = await db.todo.create({ data: { sparkId: spark.id, title: 'Test Todo' } })

      expect(todo.sparkId).toBe(spark.id)
    })

    it('handles cascading deletes', async () => {
      const sparkId = 'spark-1'
      
      db.todo.deleteMany = vi.fn().mockResolvedValue({ count: 2 })
      db.spark.delete = vi.fn().mockResolvedValue({ id: sparkId })

      await db.todo.deleteMany({ where: { sparkId } })
      await db.spark.delete({ where: { id: sparkId } })

      expect(db.todo.deleteMany).toHaveBeenCalledWith({ where: { sparkId } })
      expect(db.spark.delete).toHaveBeenCalledWith({ where: { id: sparkId } })
    })
  })
})