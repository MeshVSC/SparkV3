import { GamificationService } from '@/lib/gamification'
import { AchievementType } from '@/types/spark'

interface UserRecord {
  id: string
  totalXP: number
  level: number
  currentStreak: number
  lastLoginAt: Date | null
  achievements: { achievementId: string }[]
  sparks: { id: string }[]
  sparkCount: number
}

const users = new Map<string, UserRecord>()
const achievements = [
  { id: 'first-spark', name: 'First Spark', description: '', icon: '🔥', xpReward: 50, type: AchievementType.MILESTONE },
  { id: 'ten-sparks', name: '10 Sparks Created', description: '', icon: '⚡️', xpReward: 100, type: AchievementType.MILESTONE },
  { id: 'seven-streak', name: '7 Day Streak', description: '', icon: '🔥', xpReward: 70, type: AchievementType.STREAK },
]

const resetDb = () => {
  users.clear()
  users.set('user-1', {
    id: 'user-1',
    totalXP: 900,
    level: 1,
    currentStreak: 3,
    lastLoginAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    achievements: [],
    sparks: Array.from({ length: 9 }, (_, i) => ({ id: `spark-${i}` })),
    sparkCount: 9,
  })
  users.set('user-2', {
    id: 'user-2',
    totalXP: 0,
    level: 1,
    currentStreak: 0,
    lastLoginAt: null,
    achievements: [],
    sparks: [],
    sparkCount: 0,
  })
}

vi.mock('@/lib/db', () => {
  const findUser = (id: string) => {
    const user = users.get(id)
    if (!user) return null
    return {
      ...user,
      userAchievements: user.achievements,
    }
  }

  return {
    db: {
      user: {
        findUnique: vi.fn(async ({ where, select, include }) => {
          const user = findUser(where.id)
          if (!user) return null
          if (select) {
            const subset: Record<string, unknown> = {}
            Object.keys(select).forEach((key) => {
              subset[key] = (user as any)[key]
            })
            return subset
          }
          if (include?.achievements) {
            return {
              ...user,
              achievements: user.achievements.map((ua) => ({
                achievementId: ua.achievementId,
                achievement: achievements.find((a) => a.id === ua.achievementId) || null,
              })),
              sparks: Array.from({ length: user.sparkCount }, (_, i) => ({ id: `spark-${i}` })),
            }
          }
          return {
            ...user,
            sparks: Array.from({ length: user.sparkCount }, (_, i) => ({ id: `spark-${i}` })),
          }
        }),
        update: vi.fn(async ({ where, data }) => {
          const user = users.get(where.id)
          if (!user) throw new Error('User not found')
          Object.assign(user, data)
          return { ...user }
        }),
      },
      achievement: {
        findMany: vi.fn(async ({ where }) => {
          if (!where?.id?.notIn) {
            return achievements
          }
          return achievements.filter((achievement) => !where.id.notIn.includes(achievement.id))
        }),
      },
      userAchievement: {
        findMany: vi.fn(async ({ where }) => {
          const user = users.get(where.userId)
          if (!user) return []
          return user.achievements.map((ua) => ({ achievementId: ua.achievementId }))
        }),
        findUnique: vi.fn(async () => null),
        create: vi.fn(async ({ data }) => {
          const user = users.get(data.userId)
          if (!user) throw new Error('User not found')
          user.achievements.push({ achievementId: data.achievementId })
          return data
        }),
      },
      spark: {
        count: vi.fn(async ({ where }) => {
          const userId = where?.userId
          const user = userId ? users.get(userId) : null
          return user ? user.sparkCount : 0
        }),
      },
      todo: {
        count: vi.fn(async () => 0),
      },
      attachment: {
        count: vi.fn(async () => 0),
      },
      sparkConnection: {
        count: vi.fn(async () => 0),
      },
    },
  }
})

describe('Gamification system', () => {
  beforeEach(() => {
    resetDb()
    vi.clearAllMocks()
  })

  test('awards XP and levels user when threshold reached', async () => {
    const result = await GamificationService.awardXP('user-1', {
      type: 'SPARK_CREATED',
      amount: 150,
    })

    expect(result.success).toBe(true)
    expect(result.totalXP).toBe(1050)
    expect(result.level).toBe(2)
    expect(result.leveledUp).toBe(true)
  })

  test('fails gracefully when awarding XP to unknown user', async () => {
    const outcome = await GamificationService.awardXP('missing-user', {
      type: 'SPARK_CREATED',
      amount: 50,
    })

    expect(outcome.success).toBe(false)
    expect(outcome.error).toMatch(/User not found/)
  })

  test('updates streak based on login cadence', async () => {
    const consecutive = await GamificationService.updateStreak('user-1')
    expect(consecutive.success).toBe(true)
    expect(consecutive.streak).toBe(4)

    // Simulate a 48h gap
    const user = users.get('user-1')!
    user.lastLoginAt = new Date(Date.now() - 48 * 60 * 60 * 1000)

    const reset = await GamificationService.updateStreak('user-1')
    expect(reset.streak).toBe(1)
  })

  test('unlocks milestone achievements when criteria satisfied', async () => {
    const user = users.get('user-1')!
    user.sparkCount = 10

    const outcome = await GamificationService.checkAndAwardAchievements('user-1')
    expect(outcome.success).toBe(true)
    expect(outcome.newlyUnlocked.map((a) => a?.id)).toContain('first-spark')
    expect(outcome.newlyUnlocked.map((a) => a?.id)).toContain('ten-sparks')

    // Running again should not duplicate achievements
    const repeat = await GamificationService.checkAndAwardAchievements('user-1')
    expect(repeat.newlyUnlocked).toHaveLength(0)
  })
})
