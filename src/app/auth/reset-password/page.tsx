"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const token = useMemo(() => searchParams?.get("token") ?? "", [searchParams])

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const tokenMissing = !token

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/auth/password/reset/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, password }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setError(data.error ?? "Unable to reset password. Please try again.")
        return
      }

      setSuccess(true)
    } catch (submitError) {
      console.error("Password reset confirmation failed", submitError)
      setError("Unable to reset password. Please try again later.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Reset password</CardTitle>
          <CardDescription>
            Choose a new password to regain access to your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tokenMissing ? (
            <div className="space-y-4 text-center">
              <Alert variant="destructive">
                <AlertDescription>
                  Your reset link is missing or incomplete. Request a new link and try again.
                </AlertDescription>
              </Alert>
              <Button asChild className="w-full">
                <Link href="/auth/forgot-password">Request new reset link</Link>
              </Button>
            </div>
          ) : success ? (
            <div className="space-y-4 text-center">
              <Alert className="border-green-500/50 bg-green-500/10">
                <AlertDescription>Your password has been updated successfully.</AlertDescription>
              </Alert>
              <Button asChild className="w-full">
                <Link href="/auth/signin">Return to sign in</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  minLength={8}
                  placeholder="Enter a new password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  minLength={8}
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating password...
                  </>
                ) : (
                  "Reset password"
                )}
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                Changed your mind? <Link href="/auth/signin" className="text-primary">Return to sign in</Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
