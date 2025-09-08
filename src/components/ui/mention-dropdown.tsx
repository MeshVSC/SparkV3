"use client"

import { useState, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "./avatar"
import { Card, CardContent } from "./card"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface User {
  id: string
  name: string | null
  avatar: string | null
  email: string
}

interface MentionDropdownProps {
  query: string
  onSelect: (user: { id: string; name: string | null }) => void
  className?: string
}

export function MentionDropdown({ query, onSelect, className }: MentionDropdownProps) {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    const searchUsers = async () => {
      if (query.length < 1) {
        setUsers([])
        return
      }

      setIsLoading(true)
      try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}&limit=5`)
        if (response.ok) {
          const data = await response.json()
          setUsers(data)
          setSelectedIndex(0)
        }
      } catch (error) {
        console.error("Failed to search users:", error)
      } finally {
        setIsLoading(false)
      }
    }

    const debounceTimer = setTimeout(searchUsers, 200)
    return () => clearTimeout(debounceTimer)
  }, [query])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (users.length === 0) return

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setSelectedIndex(prev => (prev + 1) % users.length)
          break
        case "ArrowUp":
          e.preventDefault()
          setSelectedIndex(prev => (prev - 1 + users.length) % users.length)
          break
        case "Enter":
          e.preventDefault()
          if (users[selectedIndex]) {
            onSelect(users[selectedIndex])
          }
          break
        case "Escape":
          e.preventDefault()
          setUsers([])
          break
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [users, selectedIndex, onSelect])

  if (!query || (users.length === 0 && !isLoading)) {
    return null
  }

  return (
    <Card className={cn("w-64 shadow-lg border", className)}>
      <CardContent className="p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
          </div>
        ) : users.length > 0 ? (
          <div className="space-y-1">
            {users.map((user, index) => (
              <div
                key={user.id}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors",
                  index === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
                )}
                onClick={() => onSelect(user)}
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={user.avatar || undefined} />
                  <AvatarFallback className="text-xs">
                    {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {user.name || "Anonymous User"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <span className="text-sm text-muted-foreground">No users found</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}