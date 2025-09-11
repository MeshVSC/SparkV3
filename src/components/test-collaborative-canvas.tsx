"use client"

import { useState, useRef, useCallback } from "react"
import { SparkCanvas } from "@/components/optimized-spark-canvas"
import { SparkProvider } from "@/contexts/spark-context"
import { UserProvider } from "@/contexts/user-context"
import { GuestProvider } from "@/contexts/guest-context"

/**
 * Test component to verify collaborative cursor and presence integration
 */
export function TestCollaborativeCanvas() {
  const [isConnected, setIsConnected] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Collaborative Canvas Test</h1>
          <div className="flex items-center gap-4">
            <div className={`px-3 py-1 rounded text-sm ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
            <div className="text-sm text-muted-foreground">
              Move your mouse over the canvas to see collaborative cursors
            </div>
          </div>
        </div>
      </header>
      
      <div className="h-[calc(100vh-80px)]">
        <GuestProvider>
          <UserProvider>
            <SparkProvider>
              <SparkCanvas />
            </SparkProvider>
          </UserProvider>
        </GuestProvider>
      </div>
    </div>
  )
}