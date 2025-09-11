"use client"

import { useState, useCallback, useMemo, memo, useRef } from "react"
import { useSpark } from "@/contexts/spark-context"
import { SparkCard } from "@/components/spark-card"
import { ExportDialog } from "@/components/export-dialog"
import { Button } from "@/components/ui/button"
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { Download } from "lucide-react"
import { Spark } from "@/types/spark"
import { CursorOverlay } from "@/components/cursor-overlay"
import { ActiveUsersIndicator } from "@/components/active-users-indicator"
import { usePresence } from "@/hooks/use-presence"
import { useUser } from "@/contexts/user-context"

interface ConnectionLine {
  id: string
  fromSparkId: string
  toSparkId: string
  fromX: number
  fromY: number
  toX: number
  toY: number
}

// Memoized connection line component for better performance
const ConnectionLine = memo(({ line }: { line: ConnectionLine }) => (
  <line
    x1={line.fromX}
    y1={line.fromY}
    x2={line.toX}
    y2={line.toY}
    stroke="hsl(var(--border))"
    strokeWidth={2}
    strokeDasharray="5,5"
    opacity={0.6}
  />
))

// Memoized spark item for virtualization
const SparkItem = memo(({
  columnIndex,
  rowIndex,
  style,
  data
}: {
  columnIndex: number
  rowIndex: number
  style: React.CSSProperties
  data: Spark[]
}) => {
  const index = rowIndex * 3 + columnIndex // Assuming 3 columns
  const spark = data[index]

  if (!spark) return <div style={style} />

  return (
    <div style={style}>
      <SparkCard
        spark={spark}
        style={{
          position: 'absolute',
          left: spark.positionX || 0,
          top: spark.positionY || 0,
        }}
      />
    </div>
  )
})

SparkItem.displayName = "SparkItem"

// Export button component for the canvas
const ExportButton = memo(({ sparks }: { sparks: Spark[] }) => {
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsExportDialogOpen(true)}
        className="bg-background border"
      >
        <Download className="h-3 w-3 mr-1" />
        Export
      </Button>
      
      <ExportDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        sparks={sparks}
      />
    </>
  )
})

ExportButton.displayName = "ExportButton"

export const SparkCanvas = memo(() => {
  const { state, actions } = useSpark()
  const { user } = useUser()
  const [activeSpark, setActiveSpark] = useState<Spark | null>(null)
  const [viewportBounds, setViewportBounds] = useState({
    minX: 0, minY: 0, maxX: 1000, maxY: 800
  })
  const canvasRef = useRef<HTMLDivElement>(null)

  // Presence hook for real-time collaboration
  const { users, cursors, isConnected, updateCursor } = usePresence({
    sparkId: 'canvas', // Global canvas presence
    userId: user?.id || 'guest-user',
    username: user?.name || user?.email || 'Guest User',
    avatarUrl: user?.avatar,
    enabled: true
  })

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Memoized visible sparks for viewport culling
  const visibleSparks = useMemo(() => {
    return state.sparks.filter(spark => {
      const x = spark.positionX || 0
      const y = spark.positionY || 0
      return x >= viewportBounds.minX - 300 &&
             x <= viewportBounds.maxX + 300 &&
             y >= viewportBounds.minY - 300 &&
             y <= viewportBounds.maxY + 300
    })
  }, [state.sparks, viewportBounds])

  // Memoized connection lines
  const connectionLines = useMemo((): ConnectionLine[] => {
    const lines: ConnectionLine[] = []

    visibleSparks.forEach(spark => {
      if (spark.connections && spark.connections.length > 0) {
        spark.connections.forEach(connection => {
          const connectedSpark = state.sparks.find(s => s.id === connection.sparkId2)
          if (connectedSpark) {
            if (!lines.some(line =>
              (line.fromSparkId === spark.id && line.toSparkId === connectedSpark.id) ||
              (line.fromSparkId === connectedSpark.id && line.toSparkId === spark.id)
            )) {
              lines.push({
                id: `${spark.id}-${connectedSpark.id}`,
                fromSparkId: spark.id,
                toSparkId: connectedSpark.id,
                fromX: (spark.positionX || 0) + 128,
                fromY: (spark.positionY || 0) + 100,
                toX: (connectedSpark.positionX || 0) + 128,
                toY: (connectedSpark.positionY || 0) + 100,
              })
            }
          }
        })
      }
    })

    return lines
  }, [visibleSparks, state.sparks])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const spark = state.sparks.find(s => s.id === event.active.id)
    setActiveSpark(spark || null)
  }, [state.sparks])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, delta } = event
    const sparkId = active.id as string

    if (delta.x !== 0 || delta.y !== 0) {
      const spark = state.sparks.find(s => s.id === sparkId)
      if (spark) {
        const newX = (spark.positionX || 0) + delta.x
        const newY = (spark.positionY || 0) + delta.y

        actions.updateSpark(sparkId, { positionX: newX, positionY: newY })
      }
    }

    setActiveSpark(null)
  }, [state.sparks, actions])

  // Viewport update handler for performance
  const handleViewportChange = useCallback((newBounds: typeof viewportBounds) => {
    setViewportBounds(newBounds)
  }, [])

  // Handle mouse movement for cursor tracking
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!canvasRef.current) return
    
    const rect = canvasRef.current.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    
    updateCursor(x, y)
  }, [updateCursor])

  return (
    <div 
      ref={canvasRef}
      className="relative w-full h-full overflow-hidden bg-background"
      onMouseMove={handleMouseMove}
    >
      {/* Canvas Controls and Presence Indicators */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <ActiveUsersIndicator 
          users={users}
          showUsernames={false}
          maxVisible={5}
        />
        <button
          className="px-3 py-1 bg-primary text-primary-foreground rounded-md text-sm"
          onClick={() => actions.setViewMode('kanban')}
        >
          Kanban View
        </button>
        <button
          className="px-3 py-1 bg-primary text-primary-foreground rounded-md text-sm"
          onClick={() => actions.setViewMode('timeline')}
        >
          Timeline View
        </button>
        <ExportButton sparks={visibleSparks} />
      </div>

      {/* Connection Status */}
      {!isConnected && (
        <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-yellow-500 text-white rounded-md text-sm">
          Disconnected
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Connection Lines SVG Layer */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          {connectionLines.map(line => (
            <ConnectionLine key={line.id} line={line} />
          ))}
        </svg>

        {/* Sparks Layer */}
        <div className="relative z-10">
          {visibleSparks.map(spark => (
            <SparkCard
              key={spark.id}
              spark={spark}
              style={{
                position: 'absolute',
                left: spark.positionX || 0,
                top: spark.positionY || 0,
                transform: activeSpark?.id === spark.id ? 'scale(1.05)' : 'scale(1)',
                transition: activeSpark?.id === spark.id ? 'none' : 'transform 0.2s ease',
              }}
            />
          ))}
        </div>

        <DragOverlay>
          {activeSpark ? (
            <SparkCard
              spark={activeSpark}
              style={{ opacity: 0.8 }}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Performance Stats (dev mode) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-4 left-4 text-xs text-muted-foreground bg-background/80 p-2 rounded">
          Visible: {visibleSparks.length} / {state.sparks.length} sparks
          <br />
          Connections: {connectionLines.length}
        </div>
      )}

      {/* Cursor Overlay */}
      <CursorOverlay cursors={cursors} />
    </div>
  )
})

SparkCanvas.displayName = "SparkCanvas"
