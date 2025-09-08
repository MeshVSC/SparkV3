"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { 
  User, 
  Settings, 
  Trophy, 
  TrendingUp, 
  Calendar, 
  Star,
  Target,
  Zap,
  Crown,
  Award,
  Activity
} from "lucide-react"

interface UserProfile {
  id: string
  email: string
  name?: string
  avatar?: string
  totalXP: number
  level: number
  currentStreak: number
  createdAt: string
  lastLoginAt?: string
  preferences?: {
    theme: "LIGHT" | "DARK" | "AUTO"
    notifications: boolean
    soundEnabled: boolean
    defaultSparkColor: string
    viewMode: "CANVAS" | "KANBAN" | "TIMELINE"
  }
  achievements: Array<{
    id: string
    unlockedAt: string
    achievement: {
      id: string
      name: string
      description: string
      icon: string
      xpReward: number
      type: string
    }
  }>
  stats: {
    totalSparks: number
    totalAchievements: number
    xpForNextLevel: number
    xpProgress: number
  }
}

export default function ProfilePage() {
  const { data: session } = useSession()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session) {
      fetchUserProfile()
    }
  }, [session])

  const fetchUserProfile = async () => {
    try {
      const response = await fetch("/api/user/profile")
      if (response.ok) {
        const data = await response.json()
        setUserProfile(data.user)
      }
    } catch (error) {
      toast.error("Failed to load profile")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!userProfile) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Failed to load profile</p>
      </div>
    )
  }

  const getLevelIcon = (level: number) => {
    if (level >= 10) return <Crown className="h-6 w-6 text-yellow-500" />
    if (level >= 5) return <Star className="h-6 w-6 text-purple-500" />
    return <Target className="h-6 w-6 text-blue-500" />
  }

  const getStreakIcon = (streak: number) => {
    if (streak >= 30) return <Zap className="h-5 w-5 text-orange-500" />
    if (streak >= 7) return <Activity className="h-5 w-5 text-green-500" />
    return <Calendar className="h-5 w-5 text-gray-500" />
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={userProfile.avatar} />
            <AvatarFallback className="text-lg">
              {userProfile.name?.charAt(0) || userProfile.email.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold">{userProfile.name || "Anonymous User"}</h1>
            <p className="text-muted-foreground">{userProfile.email}</p>
          </div>
        </div>
        <Button>
          <Settings className="h-4 w-4 mr-2" />
          Edit Profile
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Level</CardTitle>
                {getLevelIcon(userProfile.level)}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{userProfile.level}</div>
                <p className="text-xs text-muted-foreground">
                  {Math.round(userProfile.stats.xpProgress * 100)}% to next level
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total XP</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{userProfile.totalXP.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  {userProfile.stats.xpForNextLevel - (userProfile.totalXP % 1000)} XP to next level
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
                {getStreakIcon(userProfile.currentStreak)}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{userProfile.currentStreak} days</div>
                <p className="text-xs text-muted-foreground">
                  Keep it going!
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sparks</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{userProfile.stats.totalSparks}</div>
                <p className="text-xs text-muted-foreground">
                  Ideas created
                </p>
              </CardContent>
            </Card>
          </div>

          {/* XP Progress */}
          <Card>
            <CardHeader>
              <CardTitle>Level Progress</CardTitle>
              <CardDescription>
                Your XP progress towards level {userProfile.level + 1}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Level {userProfile.level}</span>
                  <span>Level {userProfile.level + 1}</span>
                </div>
                <Progress value={userProfile.stats.xpProgress * 100} className="h-3" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{(userProfile.totalXP % 1000)} XP</span>
                  <span>{userProfile.stats.xpForNextLevel} XP</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Achievements Tab */}
        <TabsContent value="achievements" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Achievements
              </CardTitle>
              <CardDescription>
                Your unlocked achievements ({userProfile.stats.totalAchievements})
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userProfile.achievements.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {userProfile.achievements.map((userAchievement) => (
                    <Card key={userAchievement.id} className="border-2 hover:border-primary/50 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="text-2xl">{userAchievement.achievement.icon}</div>
                          <Badge variant="secondary">
                            +{userAchievement.achievement.xpReward} XP
                          </Badge>
                        </div>
                        <h3 className="font-semibold">{userAchievement.achievement.name}</h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          {userAchievement.achievement.description}
                        </p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <Badge variant="outline">{userAchievement.achievement.type}</Badge>
                          <span>
                            {new Date(userAchievement.unlockedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No achievements unlocked yet</p>
                  <p className="text-sm text-muted-foreground">Keep creating sparks to earn achievements!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Preferences
              </CardTitle>
              <CardDescription>
                Your current settings and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Theme</p>
                  <p className="text-sm text-muted-foreground">{userProfile.preferences?.theme || "AUTO"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Notifications</p>
                  <p className="text-sm text-muted-foreground">{userProfile.preferences?.notifications ? "Enabled" : "Disabled"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Sound Effects</p>
                  <p className="text-sm text-muted-foreground">{userProfile.preferences?.soundEnabled ? "Enabled" : "Disabled"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Default View</p>
                  <p className="text-sm text-muted-foreground">{userProfile.preferences?.viewMode || "CANVAS"}</p>
                </div>
              </div>
              <div className="pt-4">
                <Button>Edit Preferences</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>
                Your recent achievements and activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {userProfile.achievements.slice(0, 5).map((achievement) => (
                  <div key={achievement.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl">{achievement.achievement.icon}</div>
                    <div className="flex-1">
                      <p className="font-medium">Achievement Unlocked</p>
                      <p className="text-sm text-muted-foreground">
                        {achievement.achievement.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary">+{achievement.achievement.xpReward} XP</Badge>
                      <p className="text-xs text-muted-foreground">
                        {new Date(achievement.unlockedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
                {userProfile.achievements.length === 0 && (
                  <div className="text-center py-8">
                    <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No recent activity</p>
                    <p className="text-sm text-muted-foreground">Start creating sparks to see your activity here!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}