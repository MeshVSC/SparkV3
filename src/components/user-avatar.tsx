"use client"

import { useSession } from "next-auth/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { UserMenu } from "@/components/user-menu"
import Link from "next/link"

interface UserAvatarProps {
  showMenu?: boolean
  size?: "sm" | "md" | "lg"
  onClick?: () => void
}

export function UserAvatar({ showMenu = true, size = "md", onClick }: UserAvatarProps) {
  const { data: session } = useSession()

  if (!session?.user) {
    return (
      <Button variant="outline" asChild>
        <Link href="/auth/signin">Sign In</Link>
      </Button>
    )
  }

  const sizeClasses = {
    sm: "h-6 w-6 text-xs",
    md: "h-8 w-8 text-sm",
    lg: "h-10 w-10 text-base"
  }

  const userInitials = session.user.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : session.user.email?.charAt(0).toUpperCase() || "U"

  if (showMenu) {
    return <UserMenu />
  }

  return (
    <Avatar
      className={`${sizeClasses[size]} cursor-pointer hover:opacity-80 transition-opacity`}
      onClick={onClick}
    >
      <AvatarImage src={(session.user as any).image || ""} alt={session.user.name || session.user.email || ""} />
      <AvatarFallback>
        {userInitials}
      </AvatarFallback>
    </Avatar>
  )
}
