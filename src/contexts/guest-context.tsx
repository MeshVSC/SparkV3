"use client"

import React, { createContext, useContext, useEffect, useState } from 'react'

interface GuestData {
  sparks: any[]
  todos: any[]
  preferences: any
  lastSaved: string
}

interface GuestContextType {
  isGuest: boolean
  guestId: string | null
  guestData: GuestData | null
  saveGuestData: (data: Partial<GuestData>) => void
  loadGuestData: () => GuestData | null
  clearGuestData: () => void
  migrateToAccount: (userId: string) => Promise<void>
  mergeWithAccount: (userId: string) => Promise<void>
}

const GuestContext = createContext<GuestContextType | undefined>(undefined)

export function GuestProvider({ children }: { children: React.ReactNode }) {
  const [isGuest, setIsGuest] = useState(true)
  const [guestId, setGuestId] = useState<string | null>(null)
  const [guestData, setGuestData] = useState<GuestData | null>(null)

  // Initialize guest mode on mount
  useEffect(() => {
    const checkAuthStatus = () => {
      // Only run on client side
      if (typeof window === 'undefined') return

      // Check if user is authenticated
      const session = localStorage.getItem('next-auth.session-token')
      if (session) {
        setIsGuest(false)
        return
      }

      // Check for existing guest ID or create new one
      let existingGuestId = localStorage.getItem('guestId')
      if (!existingGuestId) {
        existingGuestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        localStorage.setItem('guestId', existingGuestId)
      }
      
      setGuestId(existingGuestId)
      setIsGuest(true)
      
      // Load existing guest data
      const data = loadGuestData()
      setGuestData(data)
    }

    checkAuthStatus()
  }, [])

  const loadGuestData = (): GuestData | null => {
    if (!guestId || typeof window === 'undefined') return null
    
    try {
      const data = localStorage.getItem(`guest_data_${guestId}`)
      return data ? JSON.parse(data) : {
        sparks: [],
        todos: [],
        preferences: {
          theme: 'AUTO',
          notifications: true,
          soundEnabled: true,
          defaultSparkColor: '#10b981',
          viewMode: 'CANVAS'
        },
        lastSaved: new Date().toISOString()
      }
    } catch (error) {
      console.error('Error loading guest data:', error)
      return null
    }
  }

  const saveGuestData = (data: Partial<GuestData>) => {
    if (!guestId || typeof window === 'undefined') return

    try {
      const currentData = loadGuestData() || {
        sparks: [],
        todos: [],
        preferences: {
          theme: 'AUTO',
          notifications: true,
          soundEnabled: true,
          defaultSparkColor: '#10b981',
          viewMode: 'CANVAS'
        },
        lastSaved: new Date().toISOString()
      }

      const updatedData = {
        ...currentData,
        ...data,
        lastSaved: new Date().toISOString()
      }

      localStorage.setItem(`guest_data_${guestId}`, JSON.stringify(updatedData))
      setGuestData(updatedData)
    } catch (error) {
      console.error('Error saving guest data:', error)
    }
  }

  const clearGuestData = () => {
    if (!guestId || typeof window === 'undefined') return
    
    try {
      localStorage.removeItem(`guest_data_${guestId}`)
      localStorage.removeItem('guestId')
      setGuestData(null)
      setGuestId(null)
    } catch (error) {
      console.error('Error clearing guest data:', error)
    }
  }

  const migrateToAccount = async (userId: string) => {
    if (!guestId || !guestData) return

    try {
      // Migrate sparks
      for (const spark of guestData.sparks) {
        await fetch('/api/sparks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...spark,
            userId: userId,
            // Remove any guest-specific IDs
            id: undefined,
            createdAt: undefined,
            updatedAt: undefined
          })
        })
      }

      // Migrate todos
      for (const todo of guestData.todos) {
        await fetch('/api/sparks/' + todo.sparkId + '/todos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...todo,
            // Remove guest-specific IDs
            id: undefined,
            createdAt: undefined,
            completedAt: undefined
          })
        })
      }

      // Clear guest data after successful migration
      clearGuestData()
      setIsGuest(false)
    } catch (error) {
      console.error('Error migrating guest data:', error)
      throw error
    }
  }

  const mergeWithAccount = async (userId: string) => {
    if (!guestId || !guestData) return

    try {
      // Get existing account data
      const response = await fetch('/api/sparks')
      const existingSparks = await response.json()

      // Merge sparks (avoid duplicates by title + description)
      const existingSparkKeys = new Set(
        existingSparks.map((s: any) => `${s.title}_${s.description || ''}`)
      )

      for (const spark of guestData.sparks) {
        const sparkKey = `${spark.title}_${spark.description || ''}`
        if (!existingSparkKeys.has(sparkKey)) {
          await fetch('/api/sparks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...spark,
              userId: userId,
              id: undefined,
              createdAt: undefined,
              updatedAt: undefined
            })
          })
        }
      }

      // Clear guest data after successful merge
      clearGuestData()
    } catch (error) {
      console.error('Error merging guest data:', error)
      throw error
    }
  }

  return (
    <GuestContext.Provider value={{
      isGuest,
      guestId,
      guestData,
      saveGuestData,
      loadGuestData,
      clearGuestData,
      migrateToAccount,
      mergeWithAccount
    }}>
      {children}
    </GuestContext.Provider>
  )
}

export function useGuest() {
  const context = useContext(GuestContext)
  if (context === undefined) {
    throw new Error('useGuest must be used within a GuestProvider')
  }
  return context
}