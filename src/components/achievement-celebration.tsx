"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle, Trophy, Star, Zap } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface AchievementCelebrationProps {
  show: boolean
  achievement: {
    name: string
    description: string
    icon?: string
    xpReward: number
  } | null
  onComplete: () => void
}

export function AchievementCelebration({ show, achievement, onComplete }: AchievementCelebrationProps) {
  console.log('[AchievementCelebration] Component rendering:', {
    timestamp: new Date().toISOString(),
    show,
    achievementName: achievement?.name || 'none',
    renderCount: Math.random()
  });
  
  const [isVisible, setIsVisible] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (show && achievement) {
      setIsVisible(true)
      
      // Show toast notification
      toast({
        title: "🎉 Achievement Unlocked!",
        description: `${achievement.name} - ${achievement.description}`,
      })

      // Auto-hide after animation completes
      const timer = setTimeout(() => {
        setIsVisible(false)
        setTimeout(onComplete, 500) // Wait for exit animation
      }, 4000)

      return () => clearTimeout(timer)
    }
  }, [show, achievement, onComplete, toast])

  if (!achievement) return null

  useEffect(() => {
    console.log('[AchievementCelebration] Render return:', {
      timestamp: new Date().toISOString(),
      isVisible,
      willRenderAnimatePresence: isVisible
    })
    
    console.log('[AchievementCelebration] AnimatePresence rendering:', {
      timestamp: new Date().toISOString(),
      isVisible
    })
  })
  
  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          {/* Background overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 to-orange-500/20"
          />

          {/* Main celebration card */}
          <motion.div
            initial={{ scale: 0, rotate: -10, opacity: 0 }}
            animate={{ 
              scale: [0, 1.2, 1], 
              rotate: [-10, 5, 0], 
              opacity: 1 
            }}
            exit={{ scale: 0, rotate: 10, opacity: 0 }}
            transition={{ 
              duration: 0.6, 
              type: "spring", 
              stiffness: 300 
            }}
            className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border-2 border-yellow-400 p-8 max-w-md mx-4 pointer-events-auto"
          >
            {/* Floating particles */}
            <div className="absolute inset-0 overflow-hidden rounded-2xl">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 bg-yellow-400 rounded-full"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                  }}
                  animate={{
                    y: [0, -100, 200],
                    x: [0, Math.random() * 100 - 50, Math.random() * 100 - 50],
                    opacity: [1, 1, 0],
                    scale: [1, 1.5, 0.5],
                  }}
                  transition={{
                    duration: 2 + Math.random() * 2,
                    delay: Math.random() * 0.5,
                    repeat: Infinity,
                    repeatType: "reverse",
                  }}
                />
              ))}
            </div>

            {/* Content */}
            <div className="relative z-10 text-center">
              {/* Trophy icon with animation */}
              <motion.div
                animate={{ 
                  rotate: [0, 10, -10, 0],
                  scale: [1, 1.1, 1]
                }}
                transition={{ 
                  duration: 1, 
                  repeat: Infinity, 
                  repeatType: "reverse" 
                }}
                className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center"
              >
                <Trophy className="w-12 h-12 text-white" />
              </motion.div>

              {/* Achievement text */}
              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-2xl font-bold text-gray-900 dark:text-white mb-2"
              >
                Achievement Unlocked!
              </motion.h2>

              <motion.h3
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-xl font-semibold text-yellow-600 dark:text-yellow-400 mb-2"
              >
                {achievement.name}
              </motion.h3>

              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-gray-600 dark:text-gray-300 mb-4"
              >
                {achievement.description}
              </motion.p>

              {/* XP reward */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="flex items-center justify-center gap-2 text-lg font-semibold text-green-600 dark:text-green-400"
              >
                <Zap className="w-5 h-5" />
                +{achievement.xpReward} XP
              </motion.div>
            </div>
          </motion.div>

          {/* Corner sparkles */}
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-yellow-400"
              style={{
                top: `${20 + (i % 3) * 30}%`,
                left: `${10 + Math.floor(i / 3) * 40}%`,
              }}
              animate={{
                rotate: [0, 360],
                scale: [0, 1, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 1.5,
                delay: i * 0.1,
                repeat: Infinity,
                repeatDelay: 2,
              }}
            >
              <Star className="w-6 h-6" fill="currentColor" />
            </motion.div>
          ))}
        </div>
      )}
    </AnimatePresence>
  )
}

// Hook for triggering achievement celebrations
export function useAchievementCelebration() {
  const [currentAchievement, setCurrentAchievement] = useState<{
    name: string
    description: string
    icon?: string
    xpReward: number
  } | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)

  const celebrateAchievement = (achievement: {
    name: string
    description: string
    icon?: string
    xpReward: number
  }) => {
    setCurrentAchievement(achievement)
    setShowCelebration(true)
  }

  const handleCelebrationComplete = () => {
    setShowCelebration(false)
    setCurrentAchievement(null)
  }

  return {
    celebrateAchievement,
    CelebrationComponent: () => (
      <AchievementCelebration
        show={showCelebration}
        achievement={currentAchievement}
        onComplete={handleCelebrationComplete}
      />
    ),
  }
}