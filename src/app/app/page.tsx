"use client"

import dynamic from 'next/dynamic'

const SparkProvider = dynamic(() => import('@/contexts/spark-context').then(mod => ({ default: mod.SparkProvider })), { ssr: false })
const SparkCanvas = dynamic(() => import('@/components/spark-canvas').then(mod => ({ default: mod.SparkCanvas })), { ssr: false })
const KanbanView = dynamic(() => import('@/components/kanban-view').then(mod => ({ default: mod.KanbanView })), { ssr: false })
const TimelineView = dynamic(() => import('@/components/timeline-view').then(mod => ({ default: mod.TimelineView })), { ssr: false })
const Sidebar = dynamic(() => import('@/components/sidebar').then(mod => ({ default: mod.Sidebar })), { ssr: false })
const ConnectionManagementPanel = dynamic(() => import('@/components/connection-management-panel').then(mod => ({ default: mod.ConnectionManagementPanel })), { ssr: false })

import { useState } from "react"
import { useSpark } from "@/contexts/spark-context"
import { useGuest } from "@/contexts/guest-context"
import { PresenceProvider } from "@/components/collaboration/presence-provider"
import { OnlineUsersPanel } from "@/components/collaboration/online-users-panel"
import { useDemoPresence } from "@/hooks/use-demo-presence"

export default function App() {
  return (
    <SparkProvider>
      <PresenceProvider>
        <div className="flex h-screen bg-background">
          <Sidebar />
          <main className="flex-1 overflow-hidden relative">
            <ViewSwitcher />
            
            {/* Online users panel - positioned absolutely */}
            <div className="absolute top-4 right-4 w-64 z-10">
              <OnlineUsersPanel />
            </div>
          </main>
        </div>
      </PresenceProvider>
    </SparkProvider>
  )
}

function ViewSwitcher() {
  const { state } = useSpark()
  
  // Initialize demo presence for development
  useDemoPresence()
  
  switch (state.viewMode) {
    case "kanban":
      return <KanbanView />
    case "timeline":
      return <TimelineView />
    case "connections":
      return <ConnectionManagementPanel />
    default:
      return <SparkCanvas />
  }
}