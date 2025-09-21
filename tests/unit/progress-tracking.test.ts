import {
  calculateProgressSummary,
  calculateProgressVelocity,
  detectProgressAnomalies,
  recommendProgressActions,
} from '@/lib/progress-tracking'

const totals = {
  totalXP: 2450,
  level: 3,
  streak: 5,
  achievementsUnlocked: 4,
}

const history = [
  { date: '2024-06-01', xpGained: 120, sparksCreated: 2, completedTodos: 5, efficiency: 78 },
  { date: '2024-06-02', xpGained: 160, sparksCreated: 3, completedTodos: 7, efficiency: 82 },
  { date: '2024-06-03', xpGained: 165, sparksCreated: 4, completedTodos: 6, efficiency: 85 },
  { date: '2024-06-04', xpGained: 190, sparksCreated: 4, completedTodos: 8, efficiency: 83 },
]

describe('Progress tracking analytics', () => {
  test('summarises totals, averages, and plateau detection', () => {
    const summary = calculateProgressSummary(totals, history)

    expect(summary.totals.totalXP).toBe(2450)
    expect(summary.averageXpPerDay).toBeCloseTo(158.75, 2)
    expect(summary.averageSparksPerDay).toBeCloseTo(3.25, 2)
    expect(summary.efficiencyBand).toBe('high')
    expect(summary.xpTrend).toBe('upward')
    expect(summary.plateauDetected).toBe(false)
  })

  test('identifies plateaus when XP remains flat', () => {
    const plateauSummary = calculateProgressSummary(totals, [
      { date: '2024-06-01', xpGained: 100, sparksCreated: 1, completedTodos: 4 },
      { date: '2024-06-02', xpGained: 101, sparksCreated: 1, completedTodos: 3 },
      { date: '2024-06-03', xpGained: 99, sparksCreated: 1, completedTodos: 2 },
    ])

    expect(plateauSummary.plateauDetected).toBe(true)
    expect(plateauSummary.efficiencyBand).toBe('medium')
  })

  test('calculates progress velocity and projections', () => {
    const velocity = calculateProgressVelocity(history)
    expect(velocity.velocityPerDay).toBeCloseTo(158.75, 2)
    expect(velocity.projectedNextWeekXp).toBe(Math.round(158.75 * 7))
  })

  test('flags anomalies and regression points', () => {
    const anomalies = detectProgressAnomalies([
      { date: '2024-06-01', xpGained: 180, sparksCreated: 4, completedTodos: 6 },
      { date: '2024-06-02', xpGained: 120, sparksCreated: 2, completedTodos: 3 },
      { date: '2024-06-03', xpGained: 115, sparksCreated: 2, completedTodos: 3 },
    ])

    expect(anomalies.hasRegression).toBe(true)
    expect(anomalies.anomalies).toHaveLength(1)
    expect(anomalies.anomalies[0].date).toBe('2024-06-02')
  })

  test('produces actionable recommendations based on metrics', () => {
    const summary = calculateProgressSummary(totals, [
      { date: '2024-06-01', xpGained: 90, sparksCreated: 1, completedTodos: 2, efficiency: 55 },
      { date: '2024-06-02', xpGained: 88, sparksCreated: 1, completedTodos: 1, efficiency: 58 },
      { date: '2024-06-03', xpGained: 87, sparksCreated: 1, completedTodos: 3, efficiency: 56 },
    ])
    const anomalies = detectProgressAnomalies([
      { date: '2024-06-01', xpGained: 140, sparksCreated: 3, completedTodos: 5 },
      { date: '2024-06-02', xpGained: 80, sparksCreated: 1, completedTodos: 2 },
    ])

    const suggestions = recommendProgressActions(summary, anomalies)
    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Plateau'),
        expect.stringContaining('Efficiency under 60%'),
        expect.stringContaining('XP drop'),
      ]),
    )
  })
})
