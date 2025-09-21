"use client"

import { useEffect, useState } from "react"
import { signIn, getProviders } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Chrome, Github } from "lucide-react"

interface OAuthButtonsProps {
  onSuccess?: () => void
}

export function OAuthButtons({ onSuccess }: OAuthButtonsProps) {
  const [loading, setLoading] = useState(false)
  const [availableProviders, setAvailableProviders] = useState<{ google: boolean; github: boolean }>({
    google: false,
    github: false,
  })

  useEffect(() => {
    let mounted = true
    getProviders()
      .then((providers) => {
        if (!mounted) return
        setAvailableProviders({
          google: Boolean(providers?.google),
          github: Boolean(providers?.github),
        })
      })
      .catch((error) => {
        console.error("Failed to load auth providers", error)
      })
    return () => {
      mounted = false
    }
  }, [])

  const handleOAuthSignIn = async (provider: string) => {
    if (!availableProviders[provider as keyof typeof availableProviders]) {
      toast.error("Provider not configured")
      return
    }

    setLoading(true)
    try {
      await signIn(provider, { callbackUrl: "/" })
      onSuccess?.()
    } catch (error) {
      toast.error("Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        className="w-full flex items-center justify-center gap-2"
        disabled={loading || !availableProviders.google}
        onClick={() => handleOAuthSignIn("google")}
      >
        <Chrome className="h-4 w-4" />
        Continue with Google
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full flex items-center justify-center gap-2"
        disabled={loading || !availableProviders.github}
        onClick={() => handleOAuthSignIn("github")}
      >
        <Github className="h-4 w-4" />
        Continue with GitHub
      </Button>
    </div>
  )
}
