import { MockGamificationService, MockSparkService } from '../mocks/mock-services'
import { SparkStatus } from '@/types/spark'

describe('Mock service layer', () => {
  test('spark service performs CRUD and filtering', () => {
    const service = new MockSparkService()
    const created = service.create({
      title: 'Prototype',
      status: SparkStatus.SEEDLING,
      xp: 0,
      level: 1,
      userId: 'user-1',
      color: '#10b981',
      description: 'First draft',
    })

    expect(created.id).toMatch(/^mock_/)
    expect(service.findById(created.id)?.title).toBe('Prototype')

    const updated = service.update(created.id, {
      status: SparkStatus.SAPLING,
      xp: 120,
    })
    expect(updated.status).toBe(SparkStatus.SAPLING)
    expect(updated.xp).toBe(120)

    const filtered = service.filterByStatus(SparkStatus.SAPLING)
    expect(filtered).toHaveLength(1)

    service.delete(created.id)
    expect(service.findById(created.id)).toBeUndefined()
  })

  test('gamification service tracks XP and streaks', () => {
    const gamification = new MockGamificationService(1000)

    const xpOne = gamification.awardXP('user-1', 300)
    expect(xpOne.totalXP).toBe(300)
    expect(xpOne.level).toBe(1)
    expect(xpOne.leveledUp).toBe(false)

    const xpTwo = gamification.awardXP('user-1', 800)
    expect(xpTwo.level).toBe(2)
    expect(xpTwo.leveledUp).toBe(true)

    const firstLogin = gamification.trackLogin('user-1', new Date('2024-06-01'))
    expect(firstLogin.streak).toBe(1)

    const consecutive = gamification.trackLogin('user-1', new Date('2024-06-02'))
    expect(consecutive.streak).toBe(2)

    const reset = gamification.trackLogin('user-1', new Date('2024-06-05'))
    expect(reset.streak).toBe(1)
  })

  test('services integrate for XP rewards on spark creation', () => {
    const sparkService = new MockSparkService()
    const gamification = new MockGamificationService()

    const spark = sparkService.create({
      title: 'Rewarded spark',
      status: SparkStatus.SEEDLING,
      xp: 0,
      level: 1,
      userId: 'user-7',
      color: '#3b82f6',
    })

    const xpState = gamification.awardXP(spark.userId, 120)
    expect(xpState.totalXP).toBe(120)
    expect(sparkService.findById(spark.id)?.updatedAt).toBeInstanceOf(Date)
  })
})
