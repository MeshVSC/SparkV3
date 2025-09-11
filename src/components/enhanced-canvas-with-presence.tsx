"use client"

import React, { useState, useCallback, useMemo, memo, useRef } from "react"
import { useSpark } from "@/contexts/spark-context"
import { useUser } from "@/contexts/user-context"
import { SparkCard } from "@/components/spark-card"
import { CursorOverlay } from "@/components/cursor-overlay"
import { ActiveUsersIndicator } from "@/components/active-users-indicator"
import { usePresence } from "@/hooks/use-presence"
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { Spark } from "@/types/spark"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ZoomIn, ZoomOut, Move, Eye, EyeOff } from "lucide-react"

interface ConnectionLine {
  id: string
  fromSparkId: string
  toSparkId: string
  fromX: number
  fromY: number
  toX: number
  toY: number
}

// Enhanced connection line with activity indicators
const ConnectionLine = memo(({ line, isActive }: { line: ConnectionLine; isActive?: boolean }) => (
  <g>
    <line
      x1={line.fromX}
      y1={line.fromY}
      x2={line.toX}
      y2={line.toY}
      stroke={isActive ? "hsl(var(--primary))" : "hsl(var(--border))"}
      strokeWidth={isActive ? 3 : 2}
      strokeDasharray={isActive ? "none" : "5,5"}
      opacity={isActive ? 0.8 : 0.6}
      className={isActive ? "animate-pulse" : ""}
    />
    {isActive && (
      <circle
        cx={(line.fromX + line.toX) / 2}
        cy={(line.fromY + line.toY) / 2}
        r={4}
        fill="hsl(var(--primary))"
        className="animate-ping"
      />
    )}
  </g>
))

ConnectionLine.displayName = 'ConnectionLine';

export const EnhancedCanvasWithPresence = memo(() => {
  const { state, actions } = useSpark()
  const { user } = useUser()
  const [activeSpark, setActiveSpark] = useState<Spark | null>(null)
  const [showPresence, setShowPresence] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const canvasRef = useRef<HTMLDivElement>(null)

  // Presence hook for real-time collaboration
  const { users, cursors, isConnected, updateCursor } = usePresence({
    sparkId: 'canvas',
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

  // Get sparks being actively viewed/edited
  const activeSparkIds = useMemo(() => {
    return new Set(users.flatMap(user => 
      // Extract spark IDs from user activities or context
      user.cursor ? [user.userId] : [] // Simplified - in real app, track which sparks users are viewing
    ))
  }, [users])

  // Enhanced connection lines with activity indicators
  const connectionLines = useMemo((): ConnectionLine[] => {
    const lines: ConnectionLine[] = []

    state.sparks.forEach(spark => {
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
  }, [state.sparks])

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

  // Enhanced mouse movement handler with throttling
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!canvasRef.current || !showPresence) return
    
    const rect = canvasRef.current.getBoundingClientRect()
    const x = (event.clientX - rect.left - pan.x) / zoom
    const y = (event.clientY - rect.top - pan.y) / zoom
    
    updateCursor(x, y)
  }, [updateCursor, showPresence, pan, zoom])

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 3))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.3))
  }

  const handleResetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  return (
    <div 
      ref={canvasRef}
      className="relative w-full h-full overflow-hidden bg-background"
      onMouseMove={handleMouseMove}
    >
      {/* Enhanced Canvas Controls */}
      <div className="absolute top-4 right-4 z-20 flex gap-2 p-2 bg-background/80 backdrop-blur-sm rounded-lg border shadow-sm">
        {showPresence && (
          <ActiveUsersIndicator 
            users={users}
            showUsernames={false}
            maxVisible={5}
          />
        )}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowPresence(!showPresence)}
          className="h-8 w-8 p-0"
        >
          {showPresence ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </Button>

        <div className="flex items-center gap-1 border-r pr-2 mr-2">
          <Button variant="ghost" size="sm" onClick={handleZoomOut} className="h-8 w-8 p-0">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs px-2 min-w-[3rem] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="ghost" size="sm" onClick={handleZoomIn} className="h-8 w-8 p-0">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleResetView} className="h-8 w-8 p-0">
            <Move className="h-4 w-4" />
          </Button>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => actions.setViewMode('kanban')}
        >
          Kanban
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => actions.setViewMode('timeline')}
        >
          Timeline
        </Button>
      </div>

      {/* Enhanced Connection Status */}
      <div className="absolute top-4 left-4 z-20 flex gap-2">
        {!isConnected && (
          <Badge variant="destructive">
            Disconnected
          </Badge>
        )}
        {isConnected && users.length > 0 && (
          <Badge variant="secondary">
            {users.length} user{users.length !== 1 ? 's' : ''} online
          </Badge>
        )}
      </div>

      {/* Canvas with Transform */}
      <div 
        className="relative w-full h-full"
        style={{
          transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
          transformOrigin: '0 0'
        }}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Enhanced Connection Lines SVG Layer */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
            {connectionLines.map(line => {
              const isActive = activeSparkIds.has(line.fromSparkId) || activeSparkIds.has(line.toSparkId)
              return (
                <ConnectionLine 
                  key={line.id} 
                  line={line} 
                  isActive={isActive}
                />
              )
            })}
          </svg>

          {/* Sparks Layer with Activity Indicators */}
          <div className="relative z-10">
            {state.sparks.map(spark => (
              <div key={spark.id} className="relative">
                <SparkCard
                  spark={spark}
                  style={{
                    position: 'absolute',
                    left: spark.positionX || 0,
                    top: spark.positionY || 0,
                    transform: activeSpark?.id === spark.id ? 'scale(1.05)' : 'scale(1)',
                    transition: activeSpark?.id === spark.id ? 'none' : 'transform 0.2s ease',
                  }}
                />
              </div>
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
      </div>

      {/* Enhanced Cursor Overlay with zoom compensation */}
      {showPresence && (
        <CursorOverlay 
          cursors={cursors.map(cursor => ({
            ...cursor,
            x: cursor.x * zoom + pan.x,
            y: cursor.y * zoom + pan.y
          }))} 
        />
      )}

      {/* Performance Stats */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-4 left-4 text-xs text-muted-foreground bg-background/80 p-2 rounded z-20">
          Sparks: {state.sparks.length} | Connections: {connectionLines.length}
          <br />
          Users: {users.length} | Cursors: {cursors.length}
          <br />
          Zoom: {Math.round(zoom * 100)}% | Connected: {isConnected ? 'Yes' : 'No'}
        </div>
      )}
    </div>
  )
})

EnhancedCanvasWithPresence.displayName = "EnhancedCanvasWithPresence"