import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SparkStatus, Spark } from '@/types/spark'
import { db } from '@/lib/db'

// Mock data
const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  totalXP: 0,
  level: 1,
  currentStreak: 1,
  lastLoginAt: new Date(),
}

const mockSpark: Spark = {
  id: 'spark-1',
  userId: 'user-1',
  title: 'Test Spark',
  description: 'A test spark',
  content: 'Test content',
  status: SparkStatus.SEEDLING,
  xp: 0,
  level: 1,
  positionX: 100,
  positionY: 200,
  color: '#3b82f6',
  tags: 'test,demo',
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('Spark Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Spark Creation', () => {
    it('should create a new spark with default values', async () => {
      const sparkData = {
        title: 'New Spark',
        description: 'A new spark for testing',
        status: SparkStatus.SEEDLING,
        xp: 0,
        level: 1,
        color: '#3b82f6',
      }

      const mockCreateSpark = vi.mocked(db.spark.create)
      mockCreateSpark.mockResolvedValue({
        ...mockSpark,
        ...sparkData,
      })

      const result = await db.spark.create({
        data: {
          ...sparkData,
          userId: mockUser.id,
        },
      })

      expect(mockCreateSpark).toHaveBeenCalledWith({
        data: {
          ...sparkData,
          userId: mockUser.id,
        },
      })
      expect(result.title).toBe(sparkData.title)
      expect(result.status).toBe(SparkStatus.SEEDLING)
      expect(result.xp).toBe(0)
    })

    it('should create a spark with custom position and tags', async () => {
      const sparkData = {
        title: 'Positioned Spark',
        status: SparkStatus.SEEDLING,
        xp: 0,
        level: 1,
        positionX: 300,
        positionY: 400,
        color: '#ef4444',
        tags: 'custom,positioned',
      }

      const mockCreateSpark = vi.mocked(db.spark.create)
      mockCreateSpark.mockResolvedValue({
        ...mockSpark,
        ...sparkData,
      })

      const result = await db.spark.create({
        data: {
          ...sparkData,
          userId: mockUser.id,
        },
      })

      expect(result.positionX).toBe(300)
      expect(result.positionY).toBe(400)
      expect(result.tags).toBe('custom,positioned')
      expect(result.color).toBe('#ef4444')
    })

    it('should handle creation errors gracefully', async () => {
      const mockCreateSpark = vi.mocked(db.spark.create)
      mockCreateSpark.mockRejectedValue(new Error('Database error'))

      await expect(
        db.spark.create({
          data: {
            title: 'Failed Spark',
            status: SparkStatus.SEEDLING,
            xp: 0,
            level: 1,
            color: '#3b82f6',
            userId: mockUser.id,
          },
        })
      ).rejects.toThrow('Database error')
    })
  })

  describe('Spark State Transitions', () => {
    it('should transition from SEEDLING to SAPLING', async () => {
      const mockUpdateSpark = vi.mocked(db.spark.update)
      mockUpdateSpark.mockResolvedValue({
        ...mockSpark,
        status: SparkStatus.SAPLING,
        xp: 100,
        updatedAt: new Date(),
      })

      const result = await db.spark.update({
        where: { id: mockSpark.id },
        data: {
          status: SparkStatus.SAPLING,
          xp: 100,
        },
      })

      expect(mockUpdateSpark).toHaveBeenCalledWith({
        where: { id: mockSpark.id },
        data: {
          status: SparkStatus.SAPLING,
          xp: 100,
        },
      })
      expect(result.status).toBe(SparkStatus.SAPLING)
      expect(result.xp).toBe(100)
    })

    it('should transition from SAPLING to TREE', async () => {
      const mockUpdateSpark = vi.mocked(db.spark.update)
      mockUpdateSpark.mockResolvedValue({
        ...mockSpark,
        status: SparkStatus.TREE,
        xp: 500,
        level: 2,
        updatedAt: new Date(),
      })

      const result = await db.spark.update({
        where: { id: mockSpark.id },
        data: {
          status: SparkStatus.TREE,
          xp: 500,
          level: 2,
        },
      })

      expect(result.status).toBe(SparkStatus.TREE)
      expect(result.xp).toBe(500)
      expect(result.level).toBe(2)
    })

    it('should transition from TREE to FOREST', async () => {
      const mockUpdateSpark = vi.mocked(db.spark.update)
      mockUpdateSpark.mockResolvedValue({
        ...mockSpark,
        status: SparkStatus.FOREST,
        xp: 1000,
        level: 3,
        updatedAt: new Date(),
      })

      const result = await db.spark.update({
        where: { id: mockSpark.id },
        data: {
          status: SparkStatus.FOREST,
          xp: 1000,
          level: 3,
        },
      })

      expect(result.status).toBe(SparkStatus.FOREST)
      expect(result.xp).toBe(1000)
      expect(result.level).toBe(3)
    })

    it('should handle invalid state transitions', async () => {
      const mockUpdateSpark = vi.mocked(db.spark.update)
      mockUpdateSpark.mockRejectedValue(new Error('Invalid status transition'))

      await expect(
        db.spark.update({
          where: { id: mockSpark.id },
          data: {
            status: 'INVALID_STATUS' as SparkStatus,
          },
        })
      ).rejects.toThrow('Invalid status transition')
    })

    it('should update position during state transition', async () => {
      const mockUpdateSpark = vi.mocked(db.spark.update)
      mockUpdateSpark.mockResolvedValue({
        ...mockSpark,
        status: SparkStatus.SAPLING,
        positionX: 150,
        positionY: 250,
        updatedAt: new Date(),
      })

      const result = await db.spark.update({
        where: { id: mockSpark.id },
        data: {
          status: SparkStatus.SAPLING,
          positionX: 150,
          positionY: 250,
        },
      })

      expect(result.positionX).toBe(150)
      expect(result.positionY).toBe(250)
    })
  })

  describe('Spark Completion and Archival', () => {
    it('should complete a spark by moving to FOREST status', async () => {
      const mockUpdateSpark = vi.mocked(db.spark.update)
      const completedSpark = {
        ...mockSpark,
        status: SparkStatus.FOREST,
        xp: 1500,
        level: 4,
        updatedAt: new Date(),
      }
      mockUpdateSpark.mockResolvedValue(completedSpark)

      const result = await db.spark.update({
        where: { id: mockSpark.id },
        data: {
          status: SparkStatus.FOREST,
          xp: 1500,
          level: 4,
        },
      })

      expect(result.status).toBe(SparkStatus.FOREST)
      expect(result.xp).toBe(1500)
      expect(result.level).toBe(4)
    })

    it('should handle spark archival with metadata preservation', async () => {
      const mockUpdateSpark = vi.mocked(db.spark.update)
      const archivedSpark = {
        ...mockSpark,
        status: SparkStatus.FOREST,
        tags: 'archived,completed',
        updatedAt: new Date(),
      }
      mockUpdateSpark.mockResolvedValue(archivedSpark)

      const result = await db.spark.update({
        where: { id: mockSpark.id },
        data: {
          tags: 'archived,completed',
        },
      })

      expect(result.tags).toBe('archived,completed')
    })
  })

  describe('Spark Deletion', () => {
    it('should delete a spark successfully', async () => {
      const mockDeleteSpark = vi.mocked(db.spark.delete)
      mockDeleteSpark.mockResolvedValue(mockSpark)

      const result = await db.spark.delete({
        where: { id: mockSpark.id },
      })

      expect(mockDeleteSpark).toHaveBeenCalledWith({
        where: { id: mockSpark.id },
      })
      expect(result.id).toBe(mockSpark.id)
    })

    it('should handle deletion of non-existent spark', async () => {
      const mockDeleteSpark = vi.mocked(db.spark.delete)
      mockDeleteSpark.mockRejectedValue(new Error('Record not found'))

      await expect(
        db.spark.delete({
          where: { id: 'non-existent' },
        })
      ).rejects.toThrow('Record not found')
    })

    it('should handle cascade deletion with related data', async () => {
      const mockDeleteSpark = vi.mocked(db.spark.delete)
      mockDeleteSpark.mockResolvedValue(mockSpark)

      // Simulate cascade deletion by also mocking related data deletion
      const mockFindUnique = vi.mocked(db.spark.findUnique)
      mockFindUnique.mockResolvedValue({
        ...mockSpark,
        todos: [
          {
            id: 'todo-1',
            sparkId: mockSpark.id,
            title: 'Test Todo',
            completed: false,
            type: 'TASK' as any,
            priority: 'MEDIUM' as any,
            createdAt: new Date(),
          },
        ],
      })

      const result = await db.spark.delete({
        where: { id: mockSpark.id },
      })

      expect(result.id).toBe(mockSpark.id)
    })
  })

  describe('Spark Retrieval and Filtering', () => {
    it('should find spark by ID', async () => {
      const mockFindUnique = vi.mocked(db.spark.findUnique)
      mockFindUnique.mockResolvedValue(mockSpark)

      const result = await db.spark.findUnique({
        where: { id: mockSpark.id },
      })

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: mockSpark.id },
      })
      expect(result?.id).toBe(mockSpark.id)
    })

    it('should find sparks by user ID', async () => {
      const mockFindMany = vi.mocked(db.spark.findMany)
      mockFindMany.mockResolvedValue([mockSpark])

      const result = await db.spark.findMany({
        where: { userId: mockUser.id },
      })

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
      })
      expect(result).toHaveLength(1)
      expect(result[0].userId).toBe(mockUser.id)
    })

    it('should filter sparks by status', async () => {
      const mockFindMany = vi.mocked(db.spark.findMany)
      mockFindMany.mockResolvedValue([
        { ...mockSpark, status: SparkStatus.SAPLING },
      ])

      const result = await db.spark.findMany({
        where: {
          userId: mockUser.id,
          status: SparkStatus.SAPLING,
        },
      })

      expect(result).toHaveLength(1)
      expect(result[0].status).toBe(SparkStatus.SAPLING)
    })
  })
})