"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useSpark } from "@/contexts/spark-context"
import { BottomTabNavigation, TabItem } from "@/components/ui/bottom-tab-navigation"
import { FloatingActionButton } from "@/components/ui/floating-action-button"
import { CreateSparkDialog } from "@/components/create-spark-dialog"
import { 
  Lightbulb, 
  Kanban, 
  Clock, 
  Target,
  Trophy,
  Settings,
  Plus
} from "lucide-react"

export function MobileNavigation() {
  const router = useRouter()
  const pathname = usePathname()
  const { actions, state } = useSpark()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("sparks")

  // Get badge counts for tabs
  const completedTodos = state.sparks.reduce((sum, spark) => 
    sum + (spark.todos?.filter(todo => todo.completed).length || 0), 0
  )

  // Define main navigation tabs based on app sections
  const tabs: TabItem[] = [
    {
      id: "sparks",
      label: "Sparks",
      icon: Lightbulb,
      badge: state.sparks.length,
      onClick: () => actions.setViewMode("canvas")
    },
    {
      id: "kanban",
      label: "Board",
      icon: Kanban,
      onClick: () => actions.setViewMode("kanban")
    },
    {
      id: "timeline",
      label: "Timeline", 
      icon: Clock,
      onClick: () => actions.setViewMode("timeline")
    },
    {
      id: "connections",
      label: "Connect",
      icon: Target,
      onClick: () => actions.setViewMode("connections")
    },
    {
      id: "stats",
      label: "Stats",
      icon: Trophy,
      badge: completedTodos,
      onClick: () => {
        // Navigate to stats/achievements view
        if (pathname === "/app") {
          // Show stats in sidebar if on main app page
          actions.setViewMode("stats")
        } else {
          router.push("/app")
        }
      }
    }
  ]

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    
    // Ensure we're on the main app page for view mode changes
    if (pathname !== "/app") {
      router.push("/app")
    }
  }

  const handleCreateSpark = () => {
    setIsCreateDialogOpen(true)
  }

  return (
    <>
      {/* Bottom Tab Navigation */}
      <BottomTabNavigation
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      {/* Floating Action Button */}
      <FloatingActionButton
        onClick={handleCreateSpark}
        icon={Plus}
        ariaLabel="Create new spark"
        size="lg"
        variant="primary"
      />

      {/* Create Spark Dialog */}
      <CreateSparkDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </>
  )
}