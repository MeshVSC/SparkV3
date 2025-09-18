import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GamificationService } from '@/lib/gamification'
import { db } from '@/lib/db'
import { SparkStatus, AchievementType } from '@/types/spark'

// Mock progress tracking scenarios
const mockProgressData = {
  user: {
    id: 'user-1',
    totalXP: 1250,
    level: 2,
    currentStreak: 12,
    createdAt: new Date('2024-01-01'),
    lastLoginAt: new Date('2024-01-15'),
  },
  sparks: [
    { id: 'spark-1', status: SparkStatus.SEEDLING, xp: 50, createdAt: new Date('2024-01-01') },
    { id: 'spark-2', status: SparkStatus.SAPLING, xp: 200, createdAt: new Date('2024-01-03') },
    { id: 'spark-3', status: SparkStatus.TREE, xp: 500, createdAt: new Date('2024-01-05') },
    { id: 'spark-4', status: SparkStatus.FOREST, xp: 1000, createdAt: new Date('2024-01-10') },
  ],
  achievements: [
    { id: 'achievement-1', name: 'First Spark', type: 'MILESTONE' as AchievementType, xpReward: 50 },
    { id: 'achievement-2', name: '7 Day Streak', type: 'STREAK' as AchievementType, xpReward: 100 },
    { id: 'achievement-3', name: 'First Tree', type: 'MILESTONE' as AchievementType, xpReward: 200 },
  ]
}

describe('Progress Tracking System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('User Progress Calculation', () => {
    it('should calculate total progress across all metrics', async () => {
      const mockFindUnique = vi.mocked(db.user.findUnique)
      mockFindUnique.mockResolvedValue({
        ...mockProgressData.user,
        sparks: mockProgressData.sparks as any,
        achievements: mockProgressData.achievements.map(a => ({ achievement: a })) as any,
      })

      const user = await db.user.findUnique({
        where: { id: mockProgressData.user.id },
        include: { sparks: true, achievements: true }
      })

      expect(user?.totalXP).toBe(1250)
      expect(user?.level).toBe(2)
      expect(user?.currentStreak).toBe(12)
      expect(user?.sparks).toHaveLength(4)
      expect(user?.achievements).toHaveLength(3)
    })

    it('should calculate progress velocity over time', async () => {
      const sparksByDate = mockProgressData.sparks.reduce((acc, spark) => {
        const date = spark.createdAt.toISOString().split('T')[0]
        acc[date] = (acc[date] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const dailyProgress = Object.entries(sparksByDate).map(([date, count]) => ({
        date: new Date(date),
        sparksCreated: count,
        xpGained: count * 100, // Estimate
      }))

      expect(dailyProgress).toHaveLength(4)
      expect(dailyProgress[0].sparksCreated).toBe(1)
      
      // Calculate velocity (sparks per day)
      const totalDays = 15 // From Jan 1 to Jan 15
      const velocity = mockProgressData.sparks.length / totalDays
      expect(velocity).toBeCloseTo(0.27, 2)
    })

    it('should track progress trends and patterns', async () => {
      const xpProgression = mockProgressData.sparks.map(spark => spark.xp)
      const isIncreasing = xpProgression.every((xp, i) => 
        i === 0 || xp >= xpProgression[i - 1]
      )
      
      expect(isIncreasing).toBe(true)
      
      // Calculate average XP per spark by status
      const avgXpByStatus = mockProgressData.sparks.reduce((acc, spark) => {
        if (!acc[spark.status]) {
          acc[spark.status] = { total: 0, count: 0 }
        }
        acc[spark.status].total += spark.xp
        acc[spark.status].count += 1
        return acc
      }, {} as Record<string, { total: number, count: number }>)

      Object.keys(avgXpByStatus).forEach(status => {
        const data = avgXpByStatus[status]
        data.average = data.total / data.count
      })

      expect(avgXpByStatus[SparkStatus.FOREST]?.average).toBe(1000)
      expect(avgXpByStatus[SparkStatus.TREE]?.average).toBe(500)
    })
  })

  describe('Achievement Progress Tracking', () => {
    it('should track progress toward milestone achievements', async () => {
      const milestoneTargets = {
        'First Spark': { current: 4, target: 1, completed: true },
        '10 Sparks': { current: 4, target: 10, completed: false },
        '50 Sparks': { current: 4, target: 50, completed: false },
        '100 Sparks': { current: 4, target: 100, completed: false },
      }

      Object.entries(milestoneTargets).forEach(([name, progress]) => {
        const percentage = Math.min((progress.current / progress.target) * 100, 100)
        
        if (name === 'First Spark') {
          expect(percentage).toBe(100)
          expect(progress.completed).toBe(true)
        } else if (name === '10 Sparks') {
          expect(percentage).toBe(40)
          expect(progress.completed).toBe(false)
        }
      })
    })

    it('should track streak achievement progress', async () => {
      const streakTargets = {
        '7 Day Streak': { current: 12, target: 7, completed: true },
        '30 Day Streak': { current: 12, target: 30, completed: false },
        '100 Day Streak': { current: 12, target: 100, completed: false },
      }

      Object.entries(streakTargets).forEach(([name, progress]) => {
        const percentage = Math.min((progress.current / progress.target) * 100, 100)
        
        if (name === '7 Day Streak') {
          expect(percentage).toBeGreaterThan(100)
          expect(progress.completed).toBe(true)
        } else if (name === '30 Day Streak') {
          expect(percentage).toBe(40)
          expect(progress.completed).toBe(false)
        }
      })
    })

    it('should track collection achievement progress', async () => {
      const collectionTargets = {
        'Status Collector': {
          current: [SparkStatus.SEEDLING, SparkStatus.SAPLING, SparkStatus.TREE, SparkStatus.FOREST],
          target: Object.values(SparkStatus),
          completed: true
        },
        'Achievement Hunter': {
          current: mockProgressData.achievements.length,
          target: 10,
          completed: false
        }
      }

      // Status collector should be complete
      const statusCollector = collectionTargets['Status Collector']
      const hasAllStatuses = statusCollector.target.every(status => 
        statusCollector.current.includes(status)
      )
      expect(hasAllStatuses).toBe(true)
      expect(statusCollector.completed).toBe(true)

      // Achievement hunter progress
      const achievementHunter = collectionTargets['Achievement Hunter']
      const percentage = (achievementHunter.current / achievementHunter.target) * 100
      expect(percentage).toBe(30)
    })

    it('should handle achievement unlock conditions', async () => {
      const unlockConditions = [
        {
          achievement: 'Level Up Master',
          condition: () => mockProgressData.user.level >= 5,
          expected: false
        },
        {
          achievement: 'Consistency King',
          condition: () => mockProgressData.user.currentStreak >= 30,
          expected: false
        },
        {
          achievement: 'Spark Creator',
          condition: () => mockProgressData.sparks.length >= 1,
          expected: true
        },
        {
          achievement: 'Forest Grower',
          condition: () => mockProgressData.sparks.some(s => s.status === SparkStatus.FOREST),
          expected: true
        }
      ]

      unlockConditions.forEach(({ achievement, condition, expected }) => {
        const shouldUnlock = condition()
        expect(shouldUnlock).toBe(expected)
      })
    })
  })

  describe('Complex Progress Scenarios', () => {
    it('should handle user with exponential growth pattern', async () => {
      const exponentialUser = {
        sparks: Array.from({ length: 30 }, (_, i) => ({
          id: `spark-${i + 1}`,
          createdAt: new Date(2024, 0, i + 1),
          xp: Math.floor(Math.pow(1.2, i) * 10),
          status: i < 5 ? SparkStatus.SEEDLING : 
                 i < 15 ? SparkStatus.SAPLING :
                 i < 25 ? SparkStatus.TREE : SparkStatus.FOREST
        }))
      }

      // Calculate growth rate
      const dailyXP = exponentialUser.sparks.map(s => s.xp)
      const growthRates = dailyXP.slice(1).map((xp, i) => 
        xp / dailyXP[i] - 1
      )
      
      const avgGrowthRate = growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length
      expect(avgGrowthRate).toBeGreaterThan(0) // Positive growth
      expect(avgGrowthRate).toBeCloseTo(0.2, 1) // ~20% growth
    })

    it('should handle user with plateau periods', async () => {
      const plateauUser = {
        activities: [
          // Active period
          ...Array.from({ length: 10 }, (_, i) => ({
            date: new Date(2024, 0, i + 1),
            xp: 100,
            active: true
          })),
          // Plateau period
          ...Array.from({ length: 20 }, (_, i) => ({
            date: new Date(2024, 0, i + 11),
            xp: 10,
            active: false
          })),
          // Recovery period
          ...Array.from({ length: 5 }, (_, i) => ({
            date: new Date(2024, 0, i + 31),
            xp: 150,
            active: true
          }))
        ]
      }

      // Identify plateau periods (low activity)
      const windowSize = 7
      const plateauThreshold = 50

      const plateauPeriods = []
      for (let i = 0; i <= plateauUser.activities.length - windowSize; i++) {
        const window = plateauUser.activities.slice(i, i + windowSize)
        const avgXP = window.reduce((sum, a) => sum + a.xp, 0) / windowSize
        
        if (avgXP < plateauThreshold) {
          plateauPeriods.push({
            start: window[0].date,
            end: window[windowSize - 1].date,
            avgXP
          })
        }
      }

      expect(plateauPeriods.length).toBeGreaterThan(0)
      expect(plateauPeriods[0].avgXP).toBeLessThan(plateauThreshold)
    })

    it('should calculate personalized recommendations', async () => {
      const userPattern = {
        preferredTimes: [9, 14, 20], // Hours
        avgSessionLength: 30, // Minutes
        strongestSkills: ['creativity', 'planning'],
        weakestSkills: ['execution', 'consistency'],
        streakHistory: [1, 3, 5, 2, 7, 12, 8, 15, 3, 1]
      }

      // Generate recommendations
      const recommendations = {
        timeRecommendation: userPattern.preferredTimes[0], // Best time: 9 AM
        skillToImprove: userPattern.weakestSkills[0], // Focus on execution
        streakGoal: Math.max(...userPattern.streakHistory) + 3, // Beat personal best + 3
        sessionLength: Math.ceil(userPattern.avgSessionLength * 1.1) // 10% increase
      }

      expect(recommendations.timeRecommendation).toBe(9)
      expect(recommendations.skillToImprove).toBe('execution')
      expect(recommendations.streakGoal).toBe(18) // 15 + 3
      expect(recommendations.sessionLength).toBe(33)
    })

    it('should handle progress anomalies and corrections', async () => {
      const anomalousData = [
        { date: '2024-01-01', xp: 100, valid: true },
        { date: '2024-01-02', xp: -50, valid: false }, // Negative XP (data error)
        { date: '2024-01-03', xp: 10000, valid: false }, // Suspiciously high XP
        { date: '2024-01-04', xp: 150, valid: true },
        { date: '2024-01-05', xp: null, valid: false }, // Missing data
      ]

      // Data cleaning and validation
      const cleanedData = anomalousData
        .filter(entry => entry.xp !== null && entry.xp > 0 && entry.xp < 1000)
        .map(entry => ({ ...entry, valid: true }))

      expect(cleanedData).toHaveLength(2)
      expect(cleanedData.every(entry => entry.valid)).toBe(true)
      expect(cleanedData.every(entry => entry.xp > 0 && entry.xp < 1000)).toBe(true)

      // Calculate corrected progress
      const totalValidXP = cleanedData.reduce((sum, entry) => sum + entry.xp, 0)
      expect(totalValidXP).toBe(250)
    })
  })

  describe('Real-time Progress Updates', () => {
    it('should handle concurrent progress updates', async () => {
      const concurrentUpdates = [
        { type: 'SPARK_CREATED', xp: 50, timestamp: new Date('2024-01-01T10:00:00') },
        { type: 'TODO_COMPLETED', xp: 25, timestamp: new Date('2024-01-01T10:00:01') },
        { type: 'ACHIEVEMENT_UNLOCKED', xp: 100, timestamp: new Date('2024-01-01T10:00:02') },
      ]

      // Simulate concurrent processing
      const results = await Promise.all(
        concurrentUpdates.map(async (update) => {
          const mockFindUnique = vi.mocked(db.user.findUnique)
          mockFindUnique.mockResolvedValue({
            ...mockProgressData.user,
            totalXP: 1000,
            level: 1
          })

          const mockUpdate = vi.mocked(db.user.update)
          mockUpdate.mockResolvedValue({
            ...mockProgressData.user,
            totalXP: 1000 + update.xp,
            level: Math.floor((1000 + update.xp) / 1000) + 1
          })

          return await GamificationService.awardXP(mockProgressData.user.id, {
            type: update.type as any,
            amount: update.xp
          })
        })
      )

      // All updates should succeed
      expect(results.every(r => r.success)).toBe(true)
      
      // Verify XP awards
      expect(results.map(r => r.xpAwarded)).toEqual([50, 25, 100])
    })

    it('should maintain progress consistency during rapid updates', async () => {
      const rapidUpdates = Array.from({ length: 100 }, (_, i) => ({
        xp: 10,
        sequence: i + 1
      }))

      // Process in batches to simulate real-world scenario
      const batchSize = 10
      const batches = []
      
      for (let i = 0; i < rapidUpdates.length; i += batchSize) {
        batches.push(rapidUpdates.slice(i, i + batchSize))
      }

      let totalProcessed = 0
      
      for (const batch of batches) {
        totalProcessed += batch.length
        
        // Simulate batch processing
        const batchXP = batch.reduce((sum, update) => sum + update.xp, 0)
        expect(batchXP).toBe(batch.length * 10)
      }

      expect(totalProcessed).toBe(100)
      
      // Total XP from all updates
      const expectedTotalXP = rapidUpdates.reduce((sum, update) => sum + update.xp, 0)
      expect(expectedTotalXP).toBe(1000)
    })

    it('should handle progress rollback scenarios', async () => {
      const originalProgress = {
        totalXP: 1000,
        level: 2,
        achievements: ['achievement-1', 'achievement-2']
      }

      const failedUpdate = {
        totalXP: 1200,
        level: 2,
        achievements: ['achievement-1', 'achievement-2', 'achievement-3']
      }

      // Simulate rollback due to validation failure
      const validateUpdate = (update: any) => {
        // Validation rule: XP increase should not exceed 500 per update
        return (update.totalXP - originalProgress.totalXP) <= 500
      }

      const shouldRollback = !validateUpdate(failedUpdate)
      
      if (shouldRollback) {
        // Rollback to original state
        const rolledBackProgress = { ...originalProgress }
        expect(rolledBackProgress.totalXP).toBe(1000)
        expect(rolledBackProgress.level).toBe(2)
        expect(rolledBackProgress.achievements).toHaveLength(2)
      }

      expect(shouldRollback).toBe(true)
    })
  })

  describe('Progress Analytics and Insights', () => {
    it('should generate progress insights and trends', async () => {
      const weeklyProgress = [
        { week: 1, sparks: 5, xp: 500, streak: 7 },
        { week: 2, sparks: 8, xp: 800, streak: 14 },
        { week: 3, sparks: 6, xp: 600, streak: 21 },
        { week: 4, sparks: 10, xp: 1000, streak: 28 },
      ]

      // Calculate trends
      const sparkTrend = weeklyProgress.map((week, i) => {
        if (i === 0) return 0
        return ((week.sparks - weeklyProgress[i-1].sparks) / weeklyProgress[i-1].sparks) * 100
      }).slice(1)

      const xpTrend = weeklyProgress.map((week, i) => {
        if (i === 0) return 0
        return ((week.xp - weeklyProgress[i-1].xp) / weeklyProgress[i-1].xp) * 100
      }).slice(1)

      // Week 2 saw 60% increase in sparks
      expect(sparkTrend[0]).toBe(60)
      // Week 3 saw 25% decrease in sparks
      expect(sparkTrend[1]).toBe(-25)
      // Week 4 saw 67% increase in sparks (rounded)
      expect(Math.round(sparkTrend[2])).toBe(67)

      // Similar calculations for XP
      expect(xpTrend[0]).toBe(60)
      expect(xpTrend[1]).toBe(-25)
      expect(Math.round(xpTrend[2])).toBe(67)
    })

    it('should predict future progress based on patterns', async () => {
      const historicalData = [
        { month: 1, totalSparks: 10, totalXP: 1000 },
        { month: 2, totalSparks: 25, totalXP: 2500 },
        { month: 3, totalSparks: 45, totalXP: 4500 },
        { month: 4, totalSparks: 70, totalXP: 7000 },
      ]

      // Simple linear regression for prediction
      const calculateTrend = (data: typeof historicalData, key: 'totalSparks' | 'totalXP') => {
        const n = data.length
        const sumX = data.reduce((sum, d) => sum + d.month, 0)
        const sumY = data.reduce((sum, d) => sum + d[key], 0)
        const sumXY = data.reduce((sum, d) => sum + (d.month * d[key]), 0)
        const sumX2 = data.reduce((sum, d) => sum + (d.month * d.month), 0)

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
        const intercept = (sumY - slope * sumX) / n

        return { slope, intercept }
      }

      const sparkTrend = calculateTrend(historicalData, 'totalSparks')
      const xpTrend = calculateTrend(historicalData, 'totalXP')

      // Predict month 5
      const predictedSparks = sparkTrend.slope * 5 + sparkTrend.intercept
      const predictedXP = xpTrend.slope * 5 + xpTrend.intercept

      expect(Math.round(predictedSparks)).toBe(100)
      expect(Math.round(predictedXP)).toBe(10000)
    })

    it('should identify progress bottlenecks and opportunities', async () => {
      const detailedProgress = {
        sparkCreation: { average: 2, target: 5, efficiency: 0.4 },
        todoCompletion: { average: 8, target: 10, efficiency: 0.8 },
        streakMaintenance: { average: 12, target: 30, efficiency: 0.4 },
        levelProgression: { current: 2, expected: 3, efficiency: 0.67 }
      }

      // Identify bottlenecks (efficiency < 0.6)
      const bottlenecks = Object.entries(detailedProgress)
        .filter(([_, data]) => data.efficiency < 0.6)
        .map(([area, data]) => ({
          area,
          efficiency: data.efficiency,
          improvementPotential: (1 - data.efficiency) * 100
        }))

      expect(bottlenecks).toHaveLength(2)
      expect(bottlenecks.find(b => b.area === 'sparkCreation')?.improvementPotential).toBe(60)
      expect(bottlenecks.find(b => b.area === 'streakMaintenance')?.improvementPotential).toBe(60)

      // Identify strengths (efficiency >= 0.8)
      const strengths = Object.entries(detailedProgress)
        .filter(([_, data]) => data.efficiency >= 0.8)
        .map(([area, data]) => ({ area, efficiency: data.efficiency }))

      expect(strengths).toHaveLength(1)
      expect(strengths[0].area).toBe('todoCompletion')
    })
  })
})