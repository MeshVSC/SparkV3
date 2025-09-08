"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { SignInForm } from "@/components/sign-in-form"
import { OAuthButtons } from "@/components/oauth-buttons"
import { useGuest } from "@/contexts/guest-context"
import { User, Mail, AlertTriangle, CheckCircle } from "lucide-react"

export default function SignIn() {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
  })
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [mergeMode, setMergeMode] = useState<"signup" | "login">("signup")
  const router = useRouter()
  const { isGuest, guestData, migrateToAccount, mergeWithAccount, clearGuestData } = useGuest()

  // Check if user has guest data
  useEffect(() => {
    if (isGuest && guestData && guestData.sparks && guestData.sparks.length > 0) {
      // User has guest data, we'll show merge dialog after auth
    }
  }, [isGuest, guestData])

  const handleAuthSuccess = async (userId?: string, isLogin = false) => {
    if (!isGuest || !guestData || !guestData.sparks || guestData.sparks.length === 0) {
      // No guest data to migrate
      router.push("/")
      return
    }

    if (isLogin) {
      // User is logging in, ask if they want to merge
      setMergeMode("login")
      setShowMergeDialog(true)
    } else {
      // User is signing up, automatically migrate
      try {
        if (userId) {
          await migrateToAccount(userId)
          // Show success message
          setTimeout(() => {
            router.push("/")
          }, 2000)
        }
      } catch (error) {
        console.error("Migration failed:", error)
        // Continue without migration
        router.push("/")
      }
    }
  }

  const handleMerge = async () => {
    try {
      await mergeWithAccount("current_user") // This will be handled by the auth context
      setShowMergeDialog(false)
      setTimeout(() => {
        router.push("/")
      }, 2000)
    } catch (error) {
      console.error("Merge failed:", error)
      setShowMergeDialog(false)
      router.push("/")
    }
  }

  const handleSkipMerge = () => {
    clearGuestData()
    setShowMergeDialog(false)
    router.push("/")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to Spark</CardTitle>
          <CardDescription>
            Sign in to your account or create a new one
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            {/* Sign In Tab */}
            <TabsContent value="signin" className="space-y-4">
              <SignInForm onSuccess={(userId) => handleAuthSuccess(userId, true)} />
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>

              <OAuthButtons onSuccess={() => handleAuthSuccess(undefined, true)} />
            </TabsContent>

            {/* Sign Up Tab */}
            <TabsContent value="signup" className="space-y-4">
              <form onSubmit={async (e) => {
                e.preventDefault()
                setLoading(true)
                try {
                  const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData),
                  })
                  
                  if (response.ok) {
                    const userData = await response.json()
                    // After successful registration, sign in the user
                    const signInResponse = await fetch('/api/auth/signin', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        email: formData.email,
                        password: formData.password,
                      }),
                    })
                    
                    if (signInResponse.ok) {
                      const signInData = await signInResponse.json()
                      handleAuthSuccess(signInData.user.id, false)
                    } else {
                      alert('Account created but sign in failed. Please try signing in manually.')
                    }
                  } else {
                    const error = await response.json()
                    alert(error.message || 'Registration failed')
                  }
                } catch (error) {
                  console.error('Registration error:', error)
                  alert('An error occurred during registration')
                } finally {
                  setLoading(false)
                }
              }} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="Enter your name"
                      className="pl-10"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="Enter your email"
                      className="pl-10"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Create a password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    required
                    minLength={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    Password must be at least 6 characters long
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Creating Account...' : 'Create Account'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Merge Dialog */}
      {showMergeDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                We Found Your Work
              </CardTitle>
              <CardDescription>
                {mergeMode === "signup" 
                  ? "Your previous work has been saved to your new account!"
                  : "We found unsaved work from your guest session. Would you like to merge it with your account?"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {guestData && guestData.sparks && guestData.sparks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Work to merge:</p>
                  <div className="space-y-1">
                    {guestData.sparks.slice(0, 3).map((spark, index) => (
                      <div key={index} className="text-sm text-muted-foreground">
                        • {spark.title}
                      </div>
                    ))}
                    {guestData.sparks.length > 3 && (
                      <div className="text-sm text-muted-foreground">
                        • and {guestData.sparks.length - 3} more...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {mergeMode === "signup" ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <p className="text-sm text-green-700">
                      Your work has been successfully saved to your account!
                    </p>
                  </div>
                  <Button 
                    onClick={() => router.push("/")} 
                    className="w-full"
                  >
                    Get Started
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleMerge} 
                      className="flex-1"
                    >
                      Merge Work
                    </Button>
                    <Button 
                      onClick={handleSkipMerge} 
                      variant="outline"
                      className="flex-1"
                    >
                      Skip
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Skipping will delete your local work
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}