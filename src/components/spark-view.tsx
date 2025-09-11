"use client"

import { useSpark } from "@/contexts/spark-context"
import { EnhancedCanvasWithPresence } from "@/components/enhanced-canvas-with-presence"
import { SparkCanvas } from "@/components/optimized-spark-canvas"
import { KanbanView } from "@/components/kanban-view"
import { TimelineView } from "@/components/timeline-view"

export function SparkView() {
  const { state } = useSpark()

  switch (state.viewMode) {
    case "kanban":
      return <KanbanView />
    case "timeline":
      return <TimelineView />
    case "canvas":
      return <EnhancedCanvasWithPresence />
    default:
      return <EnhancedCanvasWithPresence />
  }
}