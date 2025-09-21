export interface ProgressSnapshot {
  /** ISO date string */
  date: string
  /** XP gained that day */
  xpGained: number
  /** Sparks created that day */
  sparksCreated: number
  /** Completed todos for the day */
  completedTodos: number
  /** Optional efficiency between 0-100 */
  efficiency?: number
}

export interface ProgressTotals {
  totalXP: number
  level: number
  streak: number
  achievementsUnlocked: number
}

export interface ProgressSummary {
  totals: ProgressTotals
  averageXpPerDay: number
  averageSparksPerDay: number
  xpTrend: 'upward' | 'flat' | 'downward'
  plateauDetected: boolean
  efficiencyBand: 'high' | 'medium' | 'low'
}

export interface AnomalyDetection {
  anomalies: ProgressSnapshot[]
  hasRegression: boolean
}

export interface VelocityReport {
  velocityPerDay: number
  projectedNextWeekXp: number
}

const toDayKey = (snapshot: ProgressSnapshot) => snapshot.date.slice(0, 10)

export function calculateProgressSummary(
  totals: ProgressTotals,
  snapshots: ProgressSnapshot[],
): ProgressSummary {
  if (snapshots.length === 0) {
    return {
      totals,
      averageXpPerDay: 0,
      averageSparksPerDay: 0,
      xpTrend: 'flat',
      plateauDetected: false,
      efficiencyBand: 'medium',
    }
  }

  const uniqueDays = new Map<string, ProgressSnapshot>()
  snapshots.forEach((snapshot) => {
    uniqueDays.set(toDayKey(snapshot), snapshot)
  })

  const dailySnapshots = Array.from(uniqueDays.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  )

  const totalXpWindow = dailySnapshots.reduce((sum, snapshot) => sum + snapshot.xpGained, 0)
  const totalSparksWindow = dailySnapshots.reduce(
    (sum, snapshot) => sum + snapshot.sparksCreated,
    0,
  )
  const days = dailySnapshots.length

  const averageXpPerDay = totalXpWindow / days
  const averageSparksPerDay = totalSparksWindow / days

  const first = dailySnapshots[0]
  const last = dailySnapshots[dailySnapshots.length - 1]
  const xpTrend: ProgressSummary['xpTrend'] =
    last.xpGained > first.xpGained + 5
      ? 'upward'
      : last.xpGained < first.xpGained - 5
        ? 'downward'
        : 'flat'

  const recentWindow = dailySnapshots.slice(-3)
  const plateauDetected =
    recentWindow.length === 3 &&
    recentWindow.every((day) => Math.abs(day.xpGained - recentWindow[0].xpGained) <= 5)

  const avgEfficiency =
    dailySnapshots.reduce((sum, snapshot) => sum + (snapshot.efficiency ?? 70), 0) / days
  const efficiencyBand: ProgressSummary['efficiencyBand'] =
    avgEfficiency >= 80 ? 'high' : avgEfficiency <= 60 ? 'low' : 'medium'

  return {
    totals,
    averageXpPerDay,
    averageSparksPerDay,
    xpTrend,
    plateauDetected,
    efficiencyBand,
  }
}

export function calculateProgressVelocity(snapshots: ProgressSnapshot[]): VelocityReport {
  if (snapshots.length === 0) {
    return {
      velocityPerDay: 0,
      projectedNextWeekXp: 0,
    }
  }

  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  )

  const velocityPerDay =
    sorted.reduce((sum, snapshot) => sum + snapshot.xpGained, 0) / sorted.length

  return {
    velocityPerDay,
    projectedNextWeekXp: Math.round(velocityPerDay * 7),
  }
}

export function detectProgressAnomalies(snapshots: ProgressSnapshot[]): AnomalyDetection {
  if (snapshots.length < 2) {
    return { anomalies: [], hasRegression: false }
  }

  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  )

  const anomalies: ProgressSnapshot[] = []
  let hasRegression = false

  for (let i = 1; i < sorted.length; i += 1) {
    const diff = sorted[i - 1].xpGained - sorted[i].xpGained
    if (diff >= 40) {
      anomalies.push(sorted[i])
    }
    if (diff > 0) {
      hasRegression = true
    }
  }

  return { anomalies, hasRegression }
}

export function recommendProgressActions(summary: ProgressSummary, anomalies: AnomalyDetection): string[] {
  const suggestions: string[] = []

  if (summary.plateauDetected) {
    suggestions.push('Plateau detected: schedule a focused ideation session to boost spark creation.')
  }

  if (summary.efficiencyBand === 'low') {
    suggestions.push('Efficiency under 60%: review workflows and eliminate stalled sparks.')
  }

  if (anomalies.anomalies.length > 0) {
    suggestions.push('Large XP drop spotted: revisit recent activities to understand the regression.')
  }

  if (summary.xpTrend === 'upward') {
    suggestions.push('Momentum is strong—consider raising weekly XP targets to maintain growth.')
  }

  if (suggestions.length === 0) {
    suggestions.push('Progress is stable. Keep iterating and track next milestone completion.')
  }

  return suggestions
}
