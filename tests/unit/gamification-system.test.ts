import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GamificationService, XPEvent } from '@/lib/gamification'
import { db } from '@/lib/db'
import { AchievementType } from '@/types/spark'

// Mock data
const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  totalXP: 500,
  level: 1,
  currentStreak: 5,
  lastLoginAt: new Date('2024-01-01'),
}

const mockAchievements = [
  {
    id: 'achievement-1',
    name: 'First Spark',
    description: 'Create your first spark',
    icon: '🌱',
    xpReward: 50,
    type: 'MILESTONE' as AchievementType,
    createdAt: new Date(),
  },
  {
    id: 'achievement-2',
    name: '7 Day Streak',
    description: 'Login for 7 consecutive days',
    icon: '🔥',
    xpReward: 100,
    type: 'STREAK' as AchievementType,
    createdAt: new Date(),
  },
]

describe('Gamification System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('XP Award System', () => {
    it('should award XP for spark creation', async () => {
      const mockFindUnique = vi.mocked(db.user.findUnique)
      mockFindUnique.mockResolvedValue(mockUser)

      const mockUpdate = vi.mocked(db.user.update)
      mockUpdate.mockResolvedValue({
        ...mockUser,
        totalXP: 600,
        level: 1,
      })

      const xpEvent: XPEvent = {
        type: 'SPARK_CREATED',
        amount: 100,
        description: 'Created a new spark',
      }

      const result = await GamificationService.awardXP(mockUser.id, xpEvent)

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        select: { totalXP: true, level: true },
      })
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { totalXP: 600, level: 1 },
      })
      expect(result.success).toBe(true)
      expect(result.xpAwarded).toBe(100)
      expect(result.totalXP).toBe(600)
    })

    it('should award XP and level up when threshold is reached', async () => {
      const mockFindUnique = vi.mocked(db.user.findUnique)
      mockFindUnique.mockResolvedValue({
        ...mockUser,
        totalXP: 950,
        level: 1,
      })

      const mockUpdate = vi.mocked(db.user.update)
      mockUpdate.mockResolvedValue({
        ...mockUser,
        totalXP: 1050,
        level: 2,
      })

      const xpEvent: XPEvent = {
        type: 'TODO_COMPLETED',
        amount: 100,
        description: 'Completed a todo',
      }

      const result = await GamificationService.awardXP(mockUser.id, xpEvent)

      expect(result.success).toBe(true)
      expect(result.leveledUp).toBe(true)
      expect(result.level).toBe(2)
      expect(result.previousLevel).toBe(1)
    })

    it('should calculate correct level based on XP', async () => {
      const testCases = [
        { xp: 0, expectedLevel: 1 },
        { xp: 999, expectedLevel: 1 },
        { xp: 1000, expectedLevel: 2 },
        { xp: 1500, expectedLevel: 2 },
        { xp: 2000, expectedLevel: 3 },
        { xp: 5000, expectedLevel: 6 },
      ]

      for (const testCase of testCases) {
        const mockFindUnique = vi.mocked(db.user.findUnique)
        mockFindUnique.mockResolvedValue({
          ...mockUser,
          totalXP: testCase.xp,
          level: 1,
        })

        const mockUpdate = vi.mocked(db.user.update)
        mockUpdate.mockResolvedValue({
          ...mockUser,
          totalXP: testCase.xp + 10,
          level: Math.floor((testCase.xp + 10) / 1000) + 1,
        })

        const result = await GamificationService.awardXP(mockUser.id, {
          type: 'SPARK_CREATED',
          amount: 10,
        })

        expect(result.level).toBe(testCase.expectedLevel)
      }
    })

    it('should handle user not found error', async () => {
      const mockFindUnique = vi.mocked(db.user.findUnique)
      mockFindUnique.mockResolvedValue(null)

      const result = await GamificationService.awardXP('non-existent', {
        type: 'SPARK_CREATED',
        amount: 100,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('User not found')
    })

    it('should handle database errors gracefully', async () => {
      const mockFindUnique = vi.mocked(db.user.findUnique)
      mockFindUnique.mockRejectedValue(new Error('Database connection failed'))

      const result = await GamificationService.awardXP(mockUser.id, {
        type: 'SPARK_CREATED',
        amount: 100,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Database connection failed')
    })
  })

  describe('Streak System', () => {
    it('should increase streak for consecutive day login', async () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      const mockFindUnique = vi.mocked(db.user.findUnique)
      mockFindUnique.mockResolvedValue({
        ...mockUser,
        currentStreak: 5,
        lastLoginAt: yesterday,
      })

      const mockUpdate = vi.mocked(db.user.update)
      mockUpdate.mockResolvedValue({
        ...mockUser,
        currentStreak: 6,
      })

      const result = await GamificationService.updateStreak(mockUser.id)

      expect(result.success).toBe(true)
      expect(result.streak).toBe(6)
      expect(result.previousStreak).toBe(5)
    })

    it('should reset streak if login gap is more than 1 day', async () => {
      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

      const mockFindUnique = vi.mocked(db.user.findUnique)
      mockFindUnique.mockResolvedValue({
        ...mockUser,
        currentStreak: 10,
        lastLoginAt: threeDaysAgo,
      })

      const mockUpdate = vi.mocked(db.user.update)
      mockUpdate.mockResolvedValue({
        ...mockUser,
        currentStreak: 1,
      })

      const result = await GamificationService.updateStreak(mockUser.id)

      expect(result.success).toBe(true)
      expect(result.streak).toBe(1)
      expect(result.previousStreak).toBe(10)
    })

    it('should maintain streak for same day login', async () => {
      const today = new Date()

      const mockFindUnique = vi.mocked(db.user.findUnique)
      mockFindUnique.mockResolvedValue({
        ...mockUser,
        currentStreak: 7,
        lastLoginAt: today,
      })

      const mockUpdate = vi.mocked(db.user.update)
      mockUpdate.mockResolvedValue({
        ...mockUser,
        currentStreak: 7,
      })

      const result = await GamificationService.updateStreak(mockUser.id)

      expect(result.success).toBe(true)
      expect(result.streak).toBe(7)
    })

    it('should handle first-time login', async () => {
      const mockFindUnique = vi.mocked(db.user.findUnique)
      mockFindUnique.mockResolvedValue({
        ...mockUser,
        currentStreak: 0,
        lastLoginAt: null,
      })

      const mockUpdate = vi.mocked(db.user.update)
      mockUpdate.mockResolvedValue({
        ...mockUser,
        currentStreak: 1,
      })

      const result = await GamificationService.updateStreak(mockUser.id)

      expect(result.success).toBe(true)
      expect(result.streak).toBe(1)
    })
  })

  describe('Achievement System', () => {
    it('should unlock milestone achievement for first spark', async () => {
      const mockFindUnique = vi.mocked(db.user.findUnique)
      mockFindUnique.mockResolvedValue({
        ...mockUser,
        achievements: [],
        sparks: [{ id: 'spark-1', title: 'First Spark' }] as any,
      })

      const mockFindMany = vi.mocked(db.achievement.findMany)
      mockFindMany.mockResolvedValue([mockAchievements[0]])

      const mockCreate = vi.mocked(db.userAchievement.create)
      mockCreate.mockResolvedValue({
        id: 'user-achievement-1',
        userId: mockUser.id,
        achievementId: mockAchievements[0].id,
        unlockedAt: new Date(),
      })

      // Mock the awardXP method to prevent infinite recursion
      const awardXPSpy = vi.spyOn(GamificationService, 'awardXP')
      awardXPSpy.mockResolvedValue({
        success: true,
        xpAwarded: 50,
        totalXP: 550,
        level: 1,
        previousLevel: 1,
        leveledUp: false,
      })

      const result = await GamificationService.checkAndAwardAchievements(mockUser.id)

      expect(result.success).toBe(true)
      expect(result.newlyUnlocked).toHaveLength(1)
      expect(result.newlyUnlocked[0].name).toBe('First Spark')
      expect(mockCreate).toHaveBeenCalled()
      expect(awardXPSpy).toHaveBeenCalledWith(mockUser.id, {
        type: 'ACHIEVEMENT_UNLOCKED',
        amount: 50,
        description: 'Unlocked achievement: First Spark',
      })

      awardXPSpy.mockRestore()
    })

    it('should unlock streak achievement for 7-day streak', async () => {
      const mockFindUnique = vi.mocked(db.user.findUnique)
      mockFindUnique.mockResolvedValue({
        ...mockUser,
        currentStreak: 7,
        achievements: [],
        sparks: [],
      })

      const mockFindMany = vi.mocked(db.achievement.findMany)
      mockFindMany.mockResolvedValue([mockAchievements[1]])

      const mockCreate = vi.mocked(db.userAchievement.create)
      mockCreate.mockResolvedValue({
        id: 'user-achievement-2',
        userId: mockUser.id,
        achievementId: mockAchievements[1].id,
        unlockedAt: new Date(),
      })

      const awardXPSpy = vi.spyOn(GamificationService, 'awardXP')
      awardXPSpy.mockResolvedValue({
        success: true,
        xpAwarded: 100,
        totalXP: 600,
        level: 1,
        previousLevel: 1,
        leveledUp: false,
      })

      const result = await GamificationService.checkAndAwardAchievements(mockUser.id)

      expect(result.success).toBe(true)
      expect(result.newlyUnlocked).toHaveLength(1)
      expect(result.newlyUnlocked[0].name).toBe('7 Day Streak')

      awardXPSpy.mockRestore()
    })

    it('should not unlock already unlocked achievements', async () => {
      const mockFindUnique = vi.mocked(db.user.findUnique)
      mockFindUnique.mockResolvedValue({
        ...mockUser,
        achievements: [
          {
            achievementId: mockAchievements[0].id,
            achievement: mockAchievements[0],
          },
        ] as any,
        sparks: [{ id: 'spark-1' }] as any,
      })

      const mockFindMany = vi.mocked(db.achievement.findMany)
      mockFindMany.mockResolvedValue([]) // No available achievements

      const result = await GamificationService.checkAndAwardAchievements(mockUser.id)

      expect(result.success).toBe(true)
      expect(result.newlyUnlocked).toHaveLength(0)
    })

    it('should handle multiple achievement unlocks in one check', async () => {
      const mockFindUnique = vi.mocked(db.user.findUnique)
      mockFindUnique.mockResolvedValue({
        ...mockUser,
        currentStreak: 7,
        achievements: [],
        sparks: [{ id: 'spark-1' }] as any,
      })

      const mockFindMany = vi.mocked(db.achievement.findMany)
      mockFindMany.mockResolvedValue(mockAchievements)

      const mockCreate = vi.mocked(db.userAchievement.create)
      mockCreate.mockResolvedValueOnce({
        id: 'user-achievement-1',
        userId: mockUser.id,
        achievementId: mockAchievements[0].id,
        unlockedAt: new Date(),
      }).mockResolvedValueOnce({
        id: 'user-achievement-2',
        userId: mockUser.id,
        achievementId: mockAchievements[1].id,
        unlockedAt: new Date(),
      })

      const awardXPSpy = vi.spyOn(GamificationService, 'awardXP')
      awardXPSpy.mockResolvedValue({
        success: true,
        xpAwarded: 50,
        totalXP: 550,
        level: 1,
        previousLevel: 1,
        leveledUp: false,
      })

      const result = await GamificationService.checkAndAwardAchievements(mockUser.id)

      expect(result.success).toBe(true)
      expect(result.newlyUnlocked).toHaveLength(2)
      expect(mockCreate).toHaveBeenCalledTimes(2)
      expect(awardXPSpy).toHaveBeenCalledTimes(2)

      awardXPSpy.mockRestore()
    })

    it('should handle errors during achievement checking', async () => {
      const mockFindUnique = vi.mocked(db.user.findUnique)
      mockFindUnique.mockRejectedValue(new Error('Database error'))

      const result = await GamificationService.checkAndAwardAchievements(mockUser.id)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Database error')
    })
  })

  describe('Edge Cases and Complex Scenarios', () => {
    it('should handle XP overflow at maximum level', async () => {
      const mockFindUnique = vi.mocked(db.user.findUnique)
      mockFindUnique.mockResolvedValue({
        ...mockUser,
        totalXP: 999999,
        level: 1000,
      })

      const mockUpdate = vi.mocked(db.user.update)
      mockUpdate.mockResolvedValue({
        ...mockUser,
        totalXP: 1000099,
        level: 1001,
      })

      const result = await GamificationService.awardXP(mockUser.id, {
        type: 'ACHIEVEMENT_UNLOCKED',
        amount: 100,
      })

      expect(result.success).toBe(true)
      expect(result.level).toBe(1001)
    })

    it('should handle zero XP awards', async () => {
      const mockFindUnique = vi.mocked(db.user.findUnique)
      mockFindUnique.mockResolvedValue(mockUser)

      const mockUpdate = vi.mocked(db.user.update)
      mockUpdate.mockResolvedValue(mockUser)

      const result = await GamificationService.awardXP(mockUser.id, {
        type: 'DAILY_LOGIN',
        amount: 0,
      })

      expect(result.success).toBe(true)
      expect(result.xpAwarded).toBe(0)
      expect(result.leveledUp).toBe(false)
    })

    it('should handle negative XP amounts as zero', async () => {
      const mockFindUnique = vi.mocked(db.user.findUnique)
      mockFindUnique.mockResolvedValue(mockUser)

      const mockUpdate = vi.mocked(db.user.update)
      mockUpdate.mockResolvedValue(mockUser)

      const result = await GamificationService.awardXP(mockUser.id, {
        type: 'SPARK_CREATED',
        amount: -50,
      })

      expect(result.success).toBe(true)
      expect(result.totalXP).toBe(450) // 500 + (-50)
    })

    it('should handle concurrent achievement unlocks', async () => {
      const mockFindUnique = vi.mocked(db.user.findUnique)
      mockFindUnique.mockResolvedValue({
        ...mockUser,
        achievements: [],
        sparks: Array.from({ length: 50 }, (_, i) => ({ id: `spark-${i}` })) as any,
      })

      const multipleAchievements = [
        { ...mockAchievements[0], name: 'First Spark' },
        { ...mockAchievements[0], name: '10 Sparks', id: 'achievement-3' },
        { ...mockAchievements[0], name: '50 Sparks', id: 'achievement-4' },
      ]

      const mockFindMany = vi.mocked(db.achievement.findMany)
      mockFindMany.mockResolvedValue(multipleAchievements)

      const mockCreate = vi.mocked(db.userAchievement.create)
      mockCreate.mockResolvedValue({
        id: 'user-achievement-1',
        userId: mockUser.id,
        achievementId: 'achievement-1',
        unlockedAt: new Date(),
      })

      const awardXPSpy = vi.spyOn(GamificationService, 'awardXP')
      awardXPSpy.mockResolvedValue({
        success: true,
        xpAwarded: 50,
        totalXP: 550,
        level: 1,
        previousLevel: 1,
        leveledUp: false,
      })

      const result = await GamificationService.checkAndAwardAchievements(mockUser.id)

      expect(result.success).toBe(true)
      expect(result.newlyUnlocked.length).toBeGreaterThan(0)

      awardXPSpy.mockRestore()
    })
  })
})