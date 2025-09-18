import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SparkStatus } from '@/types/spark'

// Mock service implementations for testing
class MockSparkService {
  private sparks: any[] = []

  async create(data: any) {
    const spark = {
      id: `spark-${Date.now()}`,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.sparks.push(spark)
    return spark
  }

  async findMany(filter?: any) {
    let results = [...this.sparks]
    
    if (filter?.userId) {
      results = results.filter(s => s.userId === filter.userId)
    }
    
    if (filter?.status) {
      results = results.filter(s => s.status === filter.status)
    }
    
    return results
  }

  async update(id: string, data: any) {
    const index = this.sparks.findIndex(s => s.id === id)
    if (index === -1) throw new Error('Spark not found')
    
    this.sparks[index] = {
      ...this.sparks[index],
      ...data,
      updatedAt: new Date(),
    }
    
    return this.sparks[index]
  }

  async delete(id: string) {
    const index = this.sparks.findIndex(s => s.id === id)
    if (index === -1) throw new Error('Spark not found')
    
    const deleted = this.sparks[index]
    this.sparks.splice(index, 1)
    return deleted
  }

  async findById(id: string) {
    return this.sparks.find(s => s.id === id) || null
  }
}

class MockGamificationService {
  private users = new Map()

  async awardXP(userId: string, event: any) {
    const user = this.users.get(userId) || { totalXP: 0, level: 1 }
    const newXP = user.totalXP + event.amount
    const newLevel = Math.floor(newXP / 1000) + 1
    
    const updatedUser = { ...user, totalXP: newXP, level: newLevel }
    this.users.set(userId, updatedUser)
    
    return {
      success: true,
      xpAwarded: event.amount,
      totalXP: newXP,
      level: newLevel,
      previousLevel: user.level,
      leveledUp: newLevel > user.level,
    }
  }

  async updateStreak(userId: string) {
    const user = this.users.get(userId) || { currentStreak: 0, lastLoginAt: null }
    const now = new Date()
    
    let newStreak = user.currentStreak
    
    if (user.lastLoginAt) {
      const daysDiff = Math.floor((now.getTime() - user.lastLoginAt.getTime()) / (1000 * 60 * 60 * 24))
      if (daysDiff === 1) {
        newStreak += 1
      } else if (daysDiff > 1) {
        newStreak = 1
      }
    } else {
      newStreak = 1
    }
    
    const updatedUser = { ...user, currentStreak: newStreak, lastLoginAt: now }
    this.users.set(userId, updatedUser)
    
    return {
      success: true,
      streak: newStreak,
      previousStreak: user.currentStreak,
    }
  }

  getUser(userId: string) {
    return this.users.get(userId) || null
  }
}

describe('Mocked Data Services', () => {
  let sparkService: MockSparkService
  let gamificationService: MockGamificationService

  beforeEach(() => {
    sparkService = new MockSparkService()
    gamificationService = new MockGamificationService()
  })

  describe('MockSparkService', () => {
    it('should create sparks with unique IDs', async () => {
      const spark1 = await sparkService.create({
        userId: 'user-1',
        title: 'Test Spark 1',
        status: SparkStatus.SEEDLING,
        xp: 0,
        level: 1,
        color: '#3b82f6',
      })

      const spark2 = await sparkService.create({
        userId: 'user-1',
        title: 'Test Spark 2',
        status: SparkStatus.SEEDLING,
        xp: 0,
        level: 1,
        color: '#ef4444',
      })

      expect(spark1.id).not.toBe(spark2.id)
      expect(spark1.title).toBe('Test Spark 1')
      expect(spark2.title).toBe('Test Spark 2')
    })

    it('should filter sparks by user ID', async () => {
      await sparkService.create({ userId: 'user-1', title: 'User 1 Spark', status: SparkStatus.SEEDLING, xp: 0, level: 1, color: '#3b82f6' })
      await sparkService.create({ userId: 'user-2', title: 'User 2 Spark', status: SparkStatus.SEEDLING, xp: 0, level: 1, color: '#3b82f6' })

      const user1Sparks = await sparkService.findMany({ userId: 'user-1' })
      const user2Sparks = await sparkService.findMany({ userId: 'user-2' })

      expect(user1Sparks).toHaveLength(1)
      expect(user2Sparks).toHaveLength(1)
      expect(user1Sparks[0].title).toBe('User 1 Spark')
      expect(user2Sparks[0].title).toBe('User 2 Spark')
    })

    it('should filter sparks by status', async () => {
      await sparkService.create({ userId: 'user-1', title: 'Seedling', status: SparkStatus.SEEDLING, xp: 0, level: 1, color: '#3b82f6' })
      await sparkService.create({ userId: 'user-1', title: 'Sapling', status: SparkStatus.SAPLING, xp: 100, level: 1, color: '#3b82f6' })

      const seedlings = await sparkService.findMany({ status: SparkStatus.SEEDLING })
      const saplings = await sparkService.findMany({ status: SparkStatus.SAPLING })

      expect(seedlings).toHaveLength(1)
      expect(saplings).toHaveLength(1)
      expect(seedlings[0].status).toBe(SparkStatus.SEEDLING)
      expect(saplings[0].status).toBe(SparkStatus.SAPLING)
    })

    it('should update spark properties', async () => {
      const spark = await sparkService.create({
        userId: 'user-1',
        title: 'Original Title',
        status: SparkStatus.SEEDLING,
        xp: 0,
        level: 1,
        color: '#3b82f6',
      })

      const updated = await sparkService.update(spark.id, {
        title: 'Updated Title',
        status: SparkStatus.SAPLING,
        xp: 100,
      })

      expect(updated.title).toBe('Updated Title')
      expect(updated.status).toBe(SparkStatus.SAPLING)
      expect(updated.xp).toBe(100)
      expect(updated.updatedAt).toBeInstanceOf(Date)
    })

    it('should delete sparks', async () => {
      const spark = await sparkService.create({
        userId: 'user-1',
        title: 'To be deleted',
        status: SparkStatus.SEEDLING,
        xp: 0,
        level: 1,
        color: '#3b82f6',
      })

      const deleted = await sparkService.delete(spark.id)
      expect(deleted.id).toBe(spark.id)

      const found = await sparkService.findById(spark.id)
      expect(found).toBeNull()
    })

    it('should handle spark not found errors', async () => {
      await expect(
        sparkService.update('non-existent', { title: 'New Title' })
      ).rejects.toThrow('Spark not found')

      await expect(
        sparkService.delete('non-existent')
      ).rejects.toThrow('Spark not found')
    })
  })

  describe('MockGamificationService', () => {
    it('should award XP and calculate levels', async () => {
      const result1 = await gamificationService.awardXP('user-1', {
        type: 'SPARK_CREATED',
        amount: 500,
      })

      expect(result1.success).toBe(true)
      expect(result1.xpAwarded).toBe(500)
      expect(result1.totalXP).toBe(500)
      expect(result1.level).toBe(1)
      expect(result1.leveledUp).toBe(false)

      const result2 = await gamificationService.awardXP('user-1', {
        type: 'TODO_COMPLETED',
        amount: 600,
      })

      expect(result2.totalXP).toBe(1100)
      expect(result2.level).toBe(2)
      expect(result2.leveledUp).toBe(true)
      expect(result2.previousLevel).toBe(1)
    })

    it('should handle streak calculations', async () => {
      // First login
      const result1 = await gamificationService.updateStreak('user-1')
      expect(result1.streak).toBe(1)
      expect(result1.previousStreak).toBe(0)

      // Simulate next day login
      const user = gamificationService.getUser('user-1')
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      user.lastLoginAt = yesterday
      
      const result2 = await gamificationService.updateStreak('user-1')
      expect(result2.streak).toBe(2)
      expect(result2.previousStreak).toBe(1)
    })

    it('should reset streak after gap', async () => {
      // Initial streak
      await gamificationService.updateStreak('user-1')
      await gamificationService.updateStreak('user-1')
      
      const user = gamificationService.getUser('user-1')
      expect(user.currentStreak).toBe(2)

      // Simulate 3-day gap
      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
      user.lastLoginAt = threeDaysAgo

      const result = await gamificationService.updateStreak('user-1')
      expect(result.streak).toBe(1) // Reset to 1
      expect(result.previousStreak).toBe(2)
    })

    it('should handle multiple users independently', async () => {
      await gamificationService.awardXP('user-1', { type: 'SPARK_CREATED', amount: 300 })
      await gamificationService.awardXP('user-2', { type: 'SPARK_CREATED', amount: 700 })

      const user1 = gamificationService.getUser('user-1')
      const user2 = gamificationService.getUser('user-2')

      expect(user1.totalXP).toBe(300)
      expect(user2.totalXP).toBe(700)
      expect(user1.level).toBe(1)
      expect(user2.level).toBe(1)
    })
  })

  describe('Service Integration', () => {
    it('should integrate spark creation with XP awards', async () => {
      // Create a spark
      const spark = await sparkService.create({
        userId: 'user-1',
        title: 'Integration Test Spark',
        status: SparkStatus.SEEDLING,
        xp: 0,
        level: 1,
        color: '#3b82f6',
      })

      // Award XP for spark creation
      const xpResult = await gamificationService.awardXP('user-1', {
        type: 'SPARK_CREATED',
        amount: 100,
      })

      // Update spark with XP
      const updatedSpark = await sparkService.update(spark.id, {
        xp: xpResult.totalXP,
      })

      expect(updatedSpark.xp).toBe(100)
      expect(xpResult.totalXP).toBe(100)

      // Verify user progress
      const user = gamificationService.getUser('user-1')
      expect(user.totalXP).toBe(100)
    })

    it('should handle spark status transitions with level progression', async () => {
      const spark = await sparkService.create({
        userId: 'user-1',
        title: 'Progression Spark',
        status: SparkStatus.SEEDLING,
        xp: 0,
        level: 1,
        color: '#3b82f6',
      })

      // Progress through statuses with XP awards
      const transitions = [
        { status: SparkStatus.SAPLING, xpReward: 200 },
        { status: SparkStatus.TREE, xpReward: 300 },
        { status: SparkStatus.FOREST, xpReward: 500 },
      ]

      for (const transition of transitions) {
        // Award XP for transition
        const xpResult = await gamificationService.awardXP('user-1', {
          type: 'SPARK_TRANSITIONED',
          amount: transition.xpReward,
        })

        // Update spark status
        await sparkService.update(spark.id, {
          status: transition.status,
          xp: xpResult.totalXP,
        })
      }

      // Verify final state
      const finalSpark = await sparkService.findById(spark.id)
      const finalUser = gamificationService.getUser('user-1')

      expect(finalSpark?.status).toBe(SparkStatus.FOREST)
      expect(finalSpark?.xp).toBe(1000) // 200 + 300 + 500
      expect(finalUser.totalXP).toBe(1000)
      expect(finalUser.level).toBe(2) // Leveled up at 1000 XP
    })

    it('should handle concurrent operations safely', async () => {
      const userId = 'user-concurrent'
      
      // Create multiple sparks concurrently
      const sparkPromises = Array.from({ length: 5 }, (_, i) =>
        sparkService.create({
          userId,
          title: `Concurrent Spark ${i + 1}`,
          status: SparkStatus.SEEDLING,
          xp: 0,
          level: 1,
          color: '#3b82f6',
        })
      )

      const sparks = await Promise.all(sparkPromises)

      // Award XP for each spark concurrently
      const xpPromises = sparks.map(() =>
        gamificationService.awardXP(userId, {
          type: 'SPARK_CREATED',
          amount: 50,
        })
      )

      const xpResults = await Promise.all(xpPromises)

      expect(sparks).toHaveLength(5)
      expect(xpResults).toHaveLength(5)
      
      // Each XP award should be successful
      expect(xpResults.every(r => r.success)).toBe(true)
      
      // Final user state should reflect all awards
      const finalUser = gamificationService.getUser(userId)
      expect(finalUser.totalXP).toBe(250) // 5 * 50
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle zero XP awards', async () => {
      const result = await gamificationService.awardXP('user-1', {
        type: 'DAILY_LOGIN',
        amount: 0,
      })

      expect(result.success).toBe(true)
      expect(result.xpAwarded).toBe(0)
      expect(result.leveledUp).toBe(false)
    })

    it('should handle large XP amounts', async () => {
      const result = await gamificationService.awardXP('user-1', {
        type: 'ACHIEVEMENT_UNLOCKED',
        amount: 10000,
      })

      expect(result.success).toBe(true)
      expect(result.totalXP).toBe(10000)
      expect(result.level).toBe(11) // 10000 / 1000 + 1
      expect(result.leveledUp).toBe(true)
    })

    it('should handle empty spark queries', async () => {
      const allSparks = await sparkService.findMany()
      const userSparks = await sparkService.findMany({ userId: 'non-existent' })

      expect(allSparks).toEqual([])
      expect(userSparks).toEqual([])
    })

    it('should maintain data consistency during errors', async () => {
      const spark = await sparkService.create({
        userId: 'user-1',
        title: 'Error Test Spark',
        status: SparkStatus.SEEDLING,
        xp: 0,
        level: 1,
        color: '#3b82f6',
      })

      // Attempt invalid update
      try {
        await sparkService.update('invalid-id', { title: 'Updated' })
      } catch (error) {
        // Original spark should be unchanged
        const unchanged = await sparkService.findById(spark.id)
        expect(unchanged?.title).toBe('Error Test Spark')
      }
    })
  })
})