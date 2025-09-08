"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Chrome, Github } from "lucide-react"

interface OAuthButtonsProps {
  onSuccess?: () => void
}

export function OAuthButtons({ onSuccess }: OAuthButtonsProps) {
  const [loading, setLoading] = useState(false)

  const handleOAuthSignIn = async (provider: string) => {
    setLoading(true)
    try {
      await signIn(provider, { callbackUrl: "/" })
      onSuccess?.()
    } catch (error) {
      toast.error("Something went wrong")
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-center text-sm text-muted-foreground py-4 border rounded-md bg-muted/30">
        <p className="font-medium mb-1">OAuth Sign-In Temporarily Disabled</p>
        <p className="text-xs">Google and GitHub sign-in will be available in production environment</p>
        <p className="text-xs mt-1">Please use email/password to create your account</p>
      </div>
    </div>
  )
}