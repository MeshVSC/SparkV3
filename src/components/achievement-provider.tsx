"use client"

import { useEffect } from "react"
import { useAchievementCelebration } from "./achievement-celebration"
import { onAchievementUnlocked, offAchievementUnlocked } from "@/lib/achievement-engine"

interface AchievementProviderProps {
  children: React.ReactNode
}

export function AchievementProvider({ children }: AchievementProviderProps) {
  const { celebrateAchievement, CelebrationComponent } = useAchievementCelebration()

  useEffect(() => {
    const handleAchievementUnlocked = (achievement: any) => {
      celebrateAchievement({
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        xpReward: achievement.xpReward,
      })
    }

    onAchievementUnlocked(handleAchievementUnlocked)

    return () => {
      offAchievementUnlocked(handleAchievementUnlocked)
    }
  }, [celebrateAchievement])

  return (
    <>
      {children}
      <CelebrationComponent />
    </>
  )
}