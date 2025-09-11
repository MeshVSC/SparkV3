'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { Socket } from 'socket.io-client'

interface User {
  id: string
  name: string
  avatar?: string
  cursor?: { x: number; y: number }
  currentSpark?: string
}

interface PresenceContextType {
  activeUsers: User[]
  currentUser: User | null
  updateCursor: (x: number, y: number) => void
  joinSpark: (sparkId: string) => void
  leaveSpark: () => void
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined)

interface SparkCollaborationProviderProps {
  children: React.ReactNode
  socket: Socket | null
}

export function SparkCollaborationProvider({ 
  children, 
  socket 
}: SparkCollaborationProviderProps) {
  const [activeUsers, setActiveUsers] = useState<User[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  useEffect(() => {
    if (!socket) return

    // Listen for presence updates
    socket.on('presence_update', (users: User[]) => {
      setActiveUsers(users)
    })

    socket.on('user_joined', (user: User) => {
      setActiveUsers(prev => [...prev.filter(u => u.id !== user.id), user])
    })

    socket.on('user_left', (userId: string) => {
      setActiveUsers(prev => prev.filter(u => u.id !== userId))
    })

    socket.on('cursor_update', ({ userId, x, y }: { userId: string; x: number; y: number }) => {
      setActiveUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, cursor: { x, y } } : user
      ))
    })

    return () => {
      socket.off('presence_update')
      socket.off('user_joined')
      socket.off('user_left')
      socket.off('cursor_update')
    }
  }, [socket])

  const updateCursor = (x: number, y: number) => {
    if (socket) {
      socket.emit('cursor_move', { x, y })
    }
  }

  const joinSpark = (sparkId: string) => {
    if (socket) {
      socket.emit('join_spark', { sparkId })
    }
  }

  const leaveSpark = () => {
    if (socket) {
      socket.emit('leave_spark')
    }
  }

  return (
    <PresenceContext.Provider
      value={{
        activeUsers,
        currentUser,
        updateCursor,
        joinSpark,
        leaveSpark
      }}
    >
      {children}
    </PresenceContext.Provider>
  )
}

export function usePresence() {
  const context = useContext(PresenceContext)
  if (context === undefined) {
    throw new Error('usePresence must be used within a SparkCollaborationProvider')
  }
  return context
}