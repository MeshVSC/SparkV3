"use client"

import { useState, useEffect } from "react"
import { useSpark } from "@/contexts/spark-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { 
  Trophy, 
  Star, 
  Target, 
  Calendar, 
  Link as LinkIcon, 
  FileText,
  CheckCircle,
  Lock,
  Sparkles,
  Award,
  TrendingUp
} from "lucide-react"

interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  xpReward: number
  type: string
  unlocked: boolean
  unlockedAt?: Date
}

interface UserProgress {
  totalSparks: number
  completedTodos: number
  totalAttachments: number
  saplingCount: number
  forestCount: number
  unlockedAchievements: number
  totalAchievements: number
  recentAchievements: any[]
}

interface AchievementCenterProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function AchievementCenter({ isOpen, onOpenChange }: AchievementCenterProps) {
  const { state } = useSpark()
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null)
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      loadAchievements()
    }
  }, [isOpen])

  const loadAchievements = async () => {
    try {
      const [achievementsResponse, progressResponse] = await Promise.all([
        fetch("/api/achievements"),
        fetch("/api/user/progress")
      ])

      const achievementsData = await achievementsResponse.json()
      const progressData = await progressResponse.json()

      setAchievements(achievementsData)
      setUserProgress(progressData)
    } catch (error) {
      console.error("Error loading achievements:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const getAchievementIcon = (type: string) => {
    switch (type) {
      case "MILESTONE":
        return <Trophy className="h-5 w-5 text-yellow-600" />
      case "STREAK":
        return <Calendar className="h-5 w-5 text-blue-600" />
      case "COLLECTION":
        return <Target className="h-5 w-5 text-purple-600" />
      default:
        return <Award className="h-5 w-5 text-gray-600" />
    }
  }

  const getProgressPercentage = () => {
    if (!userProgress) return 0
    return (userProgress.unlockedAchievements / userProgress.totalAchievements) * 100
  }

  const groupedAchievements = achievements.reduce((groups, achievement) => {
    if (!groups[achievement.type]) {
      groups[achievement.type] = []
    }
    groups[achievement.type].push(achievement)
    return groups
  }, {} as Record<string, Achievement[]>)

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Achievement Center
          </DialogTitle>
          <DialogDescription>
            Track your progress and unlock achievements as you grow your sparks and complete todos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {/* Progress Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Achievement Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {userProgress?.unlockedAchievements || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Unlocked</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {userProgress?.totalAchievements || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {getProgressPercentage().toFixed(0)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Complete</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {achievements.reduce((sum, a) => sum + (a.unlocked ? a.xpReward : 0), 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">XP Earned</div>
                </div>
              </div>
              
              <Progress value={getProgressPercentage()} className="h-2" />
            </CardContent>
          </Card>

          {/* Stats Overview */}
          {userProgress && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Your Progress Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-semibold">{userProgress.totalSparks}</div>
                    <div className="text-xs text-muted-foreground">Sparks Created</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">{userProgress.completedTodos}</div>
                    <div className="text-xs text-muted-foreground">Todos Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">{userProgress.totalAttachments}</div>
                    <div className="text-xs text-muted-foreground">Files Attached</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">{userProgress.saplingCount}</div>
                    <div className="text-xs text-muted-foreground">Saplings</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">{userProgress.forestCount}</div>
                    <div className="text-xs text-muted-foreground">Forests</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Achievements by Type */}
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="MILESTONE">Milestones</TabsTrigger>
              <TabsTrigger value="STREAK">Streaks</TabsTrigger>
              <TabsTrigger value="COLLECTION">Collections</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {achievements.map((achievement) => (
                  <AchievementCard
                    key={achievement.id}
                    achievement={achievement}
                    onClick={() => setSelectedAchievement(achievement)}
                  />
                ))}
              </div>
            </TabsContent>

            {Object.entries(groupedAchievements).map(([type, typeAchievements]) => (
              <TabsContent key={type} value={type} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {typeAchievements.map((achievement) => (
                    <AchievementCard
                      key={achievement.id}
                      achievement={achievement}
                      onClick={() => setSelectedAchievement(achievement)}
                    />
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>

          {/* Recent Achievements */}
          {userProgress?.recentAchievements && userProgress.recentAchievements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Recent Achievements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {userProgress.recentAchievements.map((userAchievement) => (
                    <div
                      key={userAchievement.id}
                      className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="text-2xl">{userAchievement.achievement.icon}</div>
                      <div className="flex-1">
                        <h4 className="font-medium">{userAchievement.achievement.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {userAchievement.achievement.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="text-xs">
                          +{userAchievement.achievement.xpReward} XP
                        </Badge>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(userAchievement.unlockedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface AchievementCardProps {
  achievement: Achievement
  onClick: () => void
}

function AchievementCard({ achievement, onClick }: AchievementCardProps) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        achievement.unlocked ? "bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200" : "opacity-60"
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`text-3xl ${achievement.unlocked ? "" : "grayscale"}`}>
            {achievement.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm line-clamp-1 mb-1">
              {achievement.name}
            </h3>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {achievement.description}
            </p>
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-xs">
                +{achievement.xpReward} XP
              </Badge>
              {achievement.unlocked ? (
                <CheckCircle className="h-3 w-3 text-green-600" />
              ) : (
                <Lock className="h-3 w-3 text-gray-400" />
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default AchievementCenter