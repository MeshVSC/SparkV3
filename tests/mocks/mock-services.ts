import { SparkStatus } from '@/types/spark'

type SparkRecord = {
  id: string
  title: string
  status: SparkStatus
  xp: number
  level: number
  createdAt: Date
  updatedAt: Date
  userId: string
  color: string
  description?: string
}

type GamificationState = {
  totalXP: number
  level: number
  streak: number
  lastLoginAt: Date | null
}

export class MockSparkService {
  private sparks: SparkRecord[] = []

  create(input: Omit<SparkRecord, 'id' | 'createdAt' | 'updatedAt'>): SparkRecord {
    const now = new Date()
    const spark: SparkRecord = {
      ...input,
      id: `mock_${Math.random().toString(36).slice(2, 10)}`,
      createdAt: now,
      updatedAt: now,
    }
    this.sparks.push(spark)
    return spark
  }

  update(id: string, updates: Partial<SparkRecord>): SparkRecord {
    const spark = this.findById(id)
    if (!spark) {
      throw new Error('Spark not found')
    }
    Object.assign(spark, updates, { updatedAt: new Date() })
    return spark
  }

  delete(id: string): void {
    this.sparks = this.sparks.filter((spark) => spark.id !== id)
  }

  findById(id: string): SparkRecord | undefined {
    return this.sparks.find((spark) => spark.id === id)
  }

  filterByStatus(status: SparkStatus): SparkRecord[] {
    return this.sparks.filter((spark) => spark.status === status)
  }

  listByUser(userId: string): SparkRecord[] {
    return this.sparks.filter((spark) => spark.userId === userId)
  }

  clear(): void {
    this.sparks = []
  }
}

export class MockGamificationService {
  private stateByUser = new Map<string, GamificationState>()

  constructor(private readonly xpThresholdPerLevel = 1000) {}

  private getState(userId: string): GamificationState {
    if (!this.stateByUser.has(userId)) {
      this.stateByUser.set(userId, {
        totalXP: 0,
        level: 1,
        streak: 0,
        lastLoginAt: null,
      })
    }
    return this.stateByUser.get(userId)!
  }

  awardXP(userId: string, amount: number) {
    const state = this.getState(userId)
    state.totalXP += amount
    const newLevel = Math.floor(state.totalXP / this.xpThresholdPerLevel) + 1
    const leveledUp = newLevel > state.level
    state.level = newLevel
    return { ...state, leveledUp }
  }

  trackLogin(userId: string, date: Date) {
    const state = this.getState(userId)
    if (!state.lastLoginAt) {
      state.streak = 1
    } else {
      const diffDays = Math.floor(
        (date.getTime() - state.lastLoginAt.getTime()) / (1000 * 60 * 60 * 24),
      )
      if (diffDays === 1) {
        state.streak += 1
      } else if (diffDays > 1) {
        state.streak = 1
      }
    }
    state.lastLoginAt = date
    return { ...state }
  }
}
