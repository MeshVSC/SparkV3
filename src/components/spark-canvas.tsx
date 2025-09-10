"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import "./spark-canvas.css" // Custom styles for touch accessibility
import { useSpark } from "@/contexts/spark-context"
import { useSearch } from "@/contexts/search-context"
import { SparkCard } from "@/components/spark-card"
import { ConnectionRecommendations } from "@/components/connection-recommendations"
import { BatchConnectionTools } from "@/components/batch-connection-tools"
import { DragConnectionOverlay } from "@/components/drag-connection-overlay"
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter, PointerSensor, useSensor, useSensors, useDraggable } from "@dnd-kit/core"
import { Spark, SparkConnection, ConnectionType } from "@/types/spark"
// import { usePresence } from "@/components/collaboration/presence-provider"
// import { UserCursors } from "@/components/collaboration/user-cursors"
import { Button } from "@/components/ui/button"
import { Toolbar } from "@/components/ui/toolbar"
import { Network, Zap, Users } from "lucide-react"

interface ConnectionLine {
  id: string
  fromSparkId: string
  toSparkId: string
  fromX: number
  fromY: number
  toX: number
  toY: number
  strength: number
  connection: SparkConnection
}

interface TouchGestureState {
  isActive: boolean
  initialTouches: TouchList | null
  lastTouches: TouchList | null
  gestureType: 'none' | 'pan' | 'pinch' | 'longpress' | 'swipe'
  startTime: number
  initialDistance: number
  initialScale: number
  currentScale: number
  panVelocity: { x: number; y: number }
  longPressTimer: NodeJS.Timeout | null
  swipeThreshold: number
  momentumTimer: NodeJS.Timeout | null
  lastMoveTime: number
  initialCenter: { x: number; y: number } | null
}

interface HapticFeedbackOptions {
  duration?: number
  pattern?: number | number[]
}

class HapticFeedback {
  private static isSupported = 'vibrate' in navigator
  
  static light(options: HapticFeedbackOptions = {}) {
    if (this.isSupported) {
      navigator.vibrate(options.duration || 50)
    }
  }
  
  static medium(options: HapticFeedbackOptions = {}) {
    if (this.isSupported) {
      navigator.vibrate(options.duration || 100)
    }
  }
  
  static strong(options: HapticFeedbackOptions = {}) {
    if (this.isSupported) {
      navigator.vibrate(options.pattern || [200])
    }
  }
  
  static selection() {
    this.light({ duration: 50 })
  }
  
  static connection() {
    this.medium({ duration: 75 })
  }
  
  static gesture() {
    this.light({ duration: 30 })
  }
}

// Draggable Spark Card Component
function DraggableSparkCard({ spark, isSelected, onClick }: { spark: Spark; isSelected: boolean; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: spark.id,
  })

  const handleClick = useCallback(() => {
    HapticFeedback.selection() // Haptic feedback for spark selection
    onClick()
  }, [onClick])

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.5 : 1,
  } : undefined

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...listeners} 
      {...attributes}
      className="touch-target" // Ensure minimum 44px touch target
    >
      <SparkCard
        spark={spark}
        isSelected={isSelected}
        onClick={handleClick}
        isDragging={isDragging}
        style={{
          minWidth: '44px',
          minHeight: '44px',
          // Ensure touch target meets accessibility standards
        }}
      />
    </div>
  )
}

export function SparkCanvas() {
  const { state, actions } = useSpark()
  const { filteredSparks } = useSearch()
  const updateCursor = (_x: number, _y: number) => {}
  const startEditingSpark = (_id: string) => {}
  const endEditingSpark = (_id: string) => {}
  const broadcastSparkChange = (_: { sparkId: string; content: string; changeType: string; position?: { x: number; y: number } }) => {}
  const [activeSpark, setActiveSpark] = useState<Spark | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [canvasTransform, setCanvasTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [touchGesture, setTouchGesture] = useState<TouchGestureState>({
    isActive: false,
    initialTouches: null,
    lastTouches: null,
    gestureType: 'none',
    startTime: 0,
    initialDistance: 0,
    initialScale: 1,
    currentScale: 1,
    panVelocity: { x: 0, y: 0 },
    longPressTimer: null,
    swipeThreshold: 50,
    momentumTimer: null,
    lastMoveTime: 0,
    initialCenter: null
  })
  const [hoveredConnection, setHoveredConnection] = useState<string | null>(null)
  const [selectedConnection, setSelectedConnection] = useState<ConnectionLine | null>(null)

  // Drag-to-connect states
  const [isDraggingConnection, setIsDraggingConnection] = useState(false)
  const [dragStartSpark, setDragStartSpark] = useState<Spark | null>(null)
  const [dragStartPosition, setDragStartPosition] = useState<{ x: number; y: number } | null>(null)
  const [dragCurrentPosition, setDragCurrentPosition] = useState<{ x: number; y: number } | null>(null)
  const [dragConnectionType, setDragConnectionType] = useState<ConnectionType>(ConnectionType.RELATED_TO)
  const [dragTargetSpark, setDragTargetSpark] = useState<Spark | null>(null)

  // Panel states
  const [showRecommendations, setShowRecommendations] = useState(false)
  const [showBatchTools, setShowBatchTools] = useState(false)
  const [recommendationTarget, setRecommendationTarget] = useState<Spark | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Touch gesture helper functions
  const getTouchDistance = useCallback((touches: TouchList): number => {
    if (touches.length < 2) return 0
    const touch1 = touches[0]
    const touch2 = touches[1]
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    )
  }, [])

  const getTouchCenter = useCallback((touches: TouchList): { x: number; y: number } => {
    let x = 0, y = 0
    for (let i = 0; i < touches.length; i++) {
      x += touches[i].clientX
      y += touches[i].clientY
    }
    return { x: x / touches.length, y: y / touches.length }
  }, [])

  const getCanvasCoordinates = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    if (!canvasRef.current) return { x: clientX, y: clientY }
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: (clientX - rect.left - canvasTransform.x) / canvasTransform.scale,
      y: (clientY - rect.top - canvasTransform.y) / canvasTransform.scale
    }
  }, [canvasTransform])

  const getSwipeDirection = useCallback((startTouch: Touch, endTouch: Touch): string => {
    const deltaX = endTouch.clientX - startTouch.clientX
    const deltaY = endTouch.clientY - startTouch.clientY
    const absDeltaX = Math.abs(deltaX)
    const absDeltaY = Math.abs(deltaY)

    if (absDeltaX > absDeltaY) {
      return deltaX > 0 ? 'right' : 'left'
    } else {
      return deltaY > 0 ? 'down' : 'up'
    }
  }, [])

  const getSwipeVelocity = useCallback((startTouch: Touch, endTouch: Touch, timeDelta: number): number => {
    const distance = Math.sqrt(
      Math.pow(endTouch.clientX - startTouch.clientX, 2) +
      Math.pow(endTouch.clientY - startTouch.clientY, 2)
    )
    return distance / timeDelta
  }, [])

  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    const currentTime = Date.now()
    
    // Clear any existing timers
    if (touchGesture.longPressTimer) {
      clearTimeout(touchGesture.longPressTimer)
    }
    if (touchGesture.momentumTimer) {
      clearTimeout(touchGesture.momentumTimer)
    }

    // Light haptic feedback for touch start
    HapticFeedback.gesture()

    // Set up long press detection for single touch
    let longPressTimer: NodeJS.Timeout | null = null
    if (e.nativeEvent.touches.length === 1) {
      longPressTimer = setTimeout(() => {
        setTouchGesture(prev => ({ ...prev, gestureType: 'longpress' }))
        HapticFeedback.strong() // Strong haptic for long press

        // Get touched spark for context menu
        const touch = e.nativeEvent.touches[0]
        const canvasCoords = getCanvasCoordinates(touch.clientX, touch.clientY)
        const touchedSpark = state.sparks.find(spark => {
          const sparkX = spark.positionX || 0
          const sparkY = spark.positionY || 0
          return canvasCoords.x >= sparkX - 22 && canvasCoords.x <= sparkX + 278 &&
                 canvasCoords.y >= sparkY - 22 && canvasCoords.y <= sparkY + 222
        })

        if (touchedSpark) {
          actions.selectSpark(touchedSpark)
          HapticFeedback.selection()
        }
      }, 500)
    }

    const gestureType = e.nativeEvent.touches.length === 2 ? 'pinch' : 'pan'
    const initialCenter = e.nativeEvent.touches.length >= 1 ? getTouchCenter(e.nativeEvent.touches) : null

    setTouchGesture({
      isActive: true,
      initialTouches: e.nativeEvent.touches,
      lastTouches: e.nativeEvent.touches,
      gestureType,
      startTime: currentTime,
      initialDistance: getTouchDistance(e.nativeEvent.touches),
      initialScale: canvasTransform.scale,
      currentScale: canvasTransform.scale,
      panVelocity: { x: 0, y: 0 },
      longPressTimer,
      swipeThreshold: 50,
      momentumTimer: null,
      lastMoveTime: currentTime,
      initialCenter
    })
  }, [touchGesture.longPressTimer, touchGesture.momentumTimer, getTouchDistance, getTouchCenter, getCanvasCoordinates, state.sparks, actions, canvasTransform.scale])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()

    if (!touchGesture.isActive || !touchGesture.initialTouches || !touchGesture.initialCenter) return

    const currentTouches = e.nativeEvent.touches
    const currentTime = Date.now()
    const timeDelta = currentTime - touchGesture.lastMoveTime

    // Clear long press timer on movement
    if (touchGesture.longPressTimer) {
      clearTimeout(touchGesture.longPressTimer)
      setTouchGesture(prev => ({ ...prev, longPressTimer: null }))
    }

    if (currentTouches.length === 2 && touchGesture.gestureType === 'pinch' && touchGesture.initialDistance > 0) {
      // Optimized pinch-to-zoom gesture
      const currentDistance = getTouchDistance(currentTouches)
      const scaleRatio = currentDistance / touchGesture.initialDistance
      const newScale = touchGesture.initialScale * scaleRatio
      const clampedScale = Math.max(0.3, Math.min(5, newScale))

      const currentCenter = getTouchCenter(currentTouches)
      
      // Calculate scale origin point for smooth zooming
      const scaleOriginX = touchGesture.initialCenter.x
      const scaleOriginY = touchGesture.initialCenter.y
      
      // Apply transform origin-based scaling
      const scaleDiff = clampedScale - touchGesture.initialScale
      const offsetX = (scaleOriginX - canvasTransform.x) * (scaleDiff / touchGesture.initialScale)
      const offsetY = (scaleOriginY - canvasTransform.y) * (scaleDiff / touchGesture.initialScale)

      setCanvasTransform(prev => ({
        scale: clampedScale,
        x: prev.x - offsetX + (currentCenter.x - touchGesture.initialCenter!.x),
        y: prev.y - offsetY + (currentCenter.y - touchGesture.initialCenter!.y)
      }))

      // Light haptic feedback for significant scale changes
      if (Math.abs(newScale - touchGesture.currentScale) > 0.1) {
        HapticFeedback.gesture()
        setTouchGesture(prev => ({ ...prev, currentScale: clampedScale }))
      }

    } else if (currentTouches.length === 1 && touchGesture.gestureType === 'pan') {
      // Enhanced pan gesture with smooth transforms
      const currentTouch = currentTouches[0]
      const initialTouch = touchGesture.initialTouches[0]
      const lastTouch = touchGesture.lastTouches?.[0] || initialTouch

      const deltaX = currentTouch.clientX - initialTouch.clientX
      const deltaY = currentTouch.clientY - initialTouch.clientY

      // Calculate instantaneous velocity for momentum
      const velocityX = timeDelta > 0 ? (currentTouch.clientX - lastTouch.clientX) / timeDelta : 0
      const velocityY = timeDelta > 0 ? (currentTouch.clientY - lastTouch.clientY) / timeDelta : 0

      // Apply smooth pan transform
      setCanvasTransform(prev => ({
        ...prev,
        x: prev.x + (currentTouch.clientX - lastTouch.clientX),
        y: prev.y + (currentTouch.clientY - lastTouch.clientY)
      }))

      setTouchGesture(prev => ({
        ...prev,
        panVelocity: { x: velocityX, y: velocityY },
        lastTouches: currentTouches,
        lastMoveTime: currentTime
      }))
    }
  }, [touchGesture, getTouchDistance, getTouchCenter, canvasTransform])

  // Mouse event handlers for drag-to-connect
  const handleSparkMouseDown = useCallback((e: React.MouseEvent, spark: Spark) => {
    // Only start connection drag on Shift+click to avoid interfering with regular drag
    if (e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()

      setIsDraggingConnection(true)
      setDragStartSpark(spark)
      setDragStartPosition({ x: e.clientX, y: e.clientY })
      setDragCurrentPosition({ x: e.clientX, y: e.clientY })
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDraggingConnection) {
      setDragCurrentPosition({ x: e.clientX, y: e.clientY })

      // Find spark under cursor for highlighting
      const element = document.elementFromPoint(e.clientX, e.clientY)
      const sparkCard = element?.closest('[data-spark-id]')
      if (sparkCard) {
        const sparkId = sparkCard.getAttribute('data-spark-id')
        const targetSpark = state.sparks.find(s => s.id === sparkId)
        if (targetSpark && targetSpark.id !== dragStartSpark?.id) {
          setDragTargetSpark(targetSpark)
        } else {
          setDragTargetSpark(null)
        }
      } else {
        setDragTargetSpark(null)
      }
    }
  }, [isDraggingConnection, dragStartSpark, state.sparks])

  const handleMouseUp = useCallback(async (e: React.MouseEvent) => {
    if (isDraggingConnection && dragStartSpark && dragTargetSpark) {
      try {
        HapticFeedback.connection() // Haptic feedback for connection creation
        await actions.createSparkConnection(
          dragStartSpark.id,
          dragTargetSpark.id,
          dragConnectionType
        )
      } catch (error) {
        console.error('Failed to create connection:', error)
      }
    }

    // Reset drag state
    setIsDraggingConnection(false)
    setDragStartSpark(null)
    setDragStartPosition(null)
    setDragCurrentPosition(null)
    setDragTargetSpark(null)
  }, [isDraggingConnection, dragStartSpark, dragTargetSpark, dragConnectionType, actions])

  const handleConnectionCreate = useCallback(async (spark1Id: string, spark2Id: string, type: ConnectionType) => {
    HapticFeedback.connection() // Haptic feedback for connection creation
    await actions.createSparkConnection(spark1Id, spark2Id, type)
  }, [actions])

  const handleShowRecommendations = useCallback((spark: Spark) => {
    setRecommendationTarget(spark)
    setShowRecommendations(true)
    setShowBatchTools(false) // Close other panels
  }, [])

  const handleShowBatchTools = useCallback(() => {
    setShowBatchTools(true)
    setShowRecommendations(false) // Close other panels
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault()

    if (!touchGesture.isActive || !touchGesture.initialTouches) return

    // Clear timers
    if (touchGesture.longPressTimer) {
      clearTimeout(touchGesture.longPressTimer)
    }
    if (touchGesture.momentumTimer) {
      clearTimeout(touchGesture.momentumTimer)
    }

    const endTime = Date.now()
    const timeDelta = endTime - touchGesture.startTime

    if (touchGesture.gestureType === 'pan' && e.nativeEvent.changedTouches.length === 1) {
      const initialTouch = touchGesture.initialTouches[0] as Touch
      const endTouch = e.nativeEvent.changedTouches[0] as Touch

      const deltaX = endTouch.clientX - initialTouch.clientX
      const deltaY = endTouch.clientY - initialTouch.clientY
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

      // Enhanced swipe gesture detection
      if (distance > touchGesture.swipeThreshold && timeDelta < 500) {
        const velocity = getSwipeVelocity(initialTouch, endTouch, timeDelta)
        const direction = getSwipeDirection(initialTouch, endTouch)

        // Handle swipe actions with improved touch target detection
        if (velocity > 0.8) { // Adjusted velocity threshold
          const canvasCoords = getCanvasCoordinates(endTouch.clientX, endTouch.clientY)
          const swipedSpark = state.sparks.find(spark => {
            const sparkX = spark.positionX || 0
            const sparkY = spark.positionY || 0
            // Expanded touch target for better accessibility (44px minimum)
            return canvasCoords.x >= sparkX - 22 && canvasCoords.x <= sparkX + 278 &&
                   canvasCoords.y >= sparkY - 22 && canvasCoords.y <= sparkY + 222
          })

          if (swipedSpark) {
            HapticFeedback.selection() // Haptic for swipe action
            switch (direction) {
              case 'left':
                // Quick select with haptic
                actions.selectSpark(swipedSpark)
                break
              case 'right':
                // Quick edit mode
                actions.selectSpark(swipedSpark)
                break
              case 'up':
                // Quick archive/complete
                HapticFeedback.medium()
                break
              case 'down':
                // Quick delete with confirmation haptic
                HapticFeedback.strong()
                break
            }
          }
        }
      }

      // Enhanced momentum scrolling with smooth animation
      const velocityMagnitude = Math.sqrt(
        touchGesture.panVelocity.x * touchGesture.panVelocity.x + 
        touchGesture.panVelocity.y * touchGesture.panVelocity.y
      )
      
      if (velocityMagnitude > 0.5) {
        // Apply momentum with easing
        const momentumDuration = Math.min(1000, velocityMagnitude * 300)
        const momentumFactor = 200 // Adjust for momentum strength
        
        let currentVelocityX = touchGesture.panVelocity.x * momentumFactor
        let currentVelocityY = touchGesture.panVelocity.y * momentumFactor
        
        const animateMomentum = () => {
          if (Math.abs(currentVelocityX) < 1 && Math.abs(currentVelocityY) < 1) {
            return
          }
          
          // Apply friction
          currentVelocityX *= 0.95
          currentVelocityY *= 0.95
          
          setCanvasTransform(prev => {
            // Calculate content bounds for momentum constraints
            const contentWidth = Math.max(...state.sparks.map(s => (s.positionX || 0) + 256))
            const contentHeight = Math.max(...state.sparks.map(s => (s.positionY || 0) + 200))
            const viewportWidth = canvasRef.current?.clientWidth || 1000
            const viewportHeight = canvasRef.current?.clientHeight || 800
            
            const maxX = Math.max(0, (contentWidth - viewportWidth) * prev.scale)
            const maxY = Math.max(0, (contentHeight - viewportHeight) * prev.scale)
            const minX = Math.min(0, -maxX)
            const minY = Math.min(0, -maxY)
            
            return {
              ...prev,
              x: Math.max(minX, Math.min(maxX, prev.x + currentVelocityX)),
              y: Math.max(minY, Math.min(maxY, prev.y + currentVelocityY))
            }
          })
          
          const momentumTimer = setTimeout(animateMomentum, 16) // ~60fps
          setTouchGesture(prev => ({ ...prev, momentumTimer }))
        }
        
        animateMomentum()
      }
    }

    // Reset gesture state
    setTouchGesture({
      isActive: false,
      initialTouches: null,
      lastTouches: null,
      gestureType: 'none',
      startTime: 0,
      initialDistance: 0,
      initialScale: canvasTransform.scale,
      currentScale: canvasTransform.scale,
      panVelocity: { x: 0, y: 0 },
      longPressTimer: null,
      swipeThreshold: 50,
      momentumTimer: null,
      lastMoveTime: 0,
      initialCenter: null
    })
  }, [touchGesture, getSwipeVelocity, getSwipeDirection, getCanvasCoordinates, state.sparks, actions, canvasTransform.scale, canvasRef])

  // Cleanup effect for timers
  useEffect(() => {
    return () => {
      if (touchGesture.longPressTimer) {
        clearTimeout(touchGesture.longPressTimer)
      }
      if (touchGesture.momentumTimer) {
        clearTimeout(touchGesture.momentumTimer)
      }
    }
  }, [touchGesture.longPressTimer, touchGesture.momentumTimer])

  // Calculate connection lines between sparks
  const getConnectionLines = useCallback((): ConnectionLine[] => {
    const lines: ConnectionLine[] = []

    state.sparks.forEach(spark => {
      if (spark.connections && spark.connections.length > 0) {
        spark.connections.forEach(connection => {
          const connectedSpark = state.sparks.find(s => s.id === connection.sparkId2)
          if (connectedSpark) {
            // Only create line once per connection (avoid duplicates)
            if (!lines.some(line =>
              (line.fromSparkId === spark.id && line.toSparkId === connectedSpark.id) ||
              (line.fromSparkId === connectedSpark.id && line.toSparkId === spark.id)
            )) {
              // Calculate connection strength based on XP levels and recency
              const totalXp = spark.xp + connectedSpark.xp
              const avgLevel = (spark.level + connectedSpark.level) / 2
              const daysSinceCreation = Math.max(1,
                (new Date().getTime() - new Date(connection.createdAt).getTime()) / (1000 * 60 * 60 * 24)
              )
              const strength = Math.min(1, (totalXp / 1000 + avgLevel / 10) / Math.sqrt(daysSinceCreation))

              lines.push({
                id: `${spark.id}-${connectedSpark.id}`,
                fromSparkId: spark.id,
                toSparkId: connectedSpark.id,
                fromX: (spark.positionX || Math.random() * 600) + 128, // Center of card (card width is 256/2)
                fromY: (spark.positionY || Math.random() * 400) + 100, // Center of card (approximate height)
                toX: (connectedSpark.positionX || Math.random() * 600) + 128,
                toY: (connectedSpark.positionY || Math.random() * 400) + 100,
                strength,
                connection,
              })
            }
          }
        })
      }
    })

    return lines
  }, [state.sparks])

  // Calculate connection lines between sparks
  const connectionLines = useCallback((): ConnectionLine[] => {
    const lines: ConnectionLine[] = []

    state.sparks.forEach(spark => {
      if (spark.connections && spark.connections.length > 0) {
        spark.connections.forEach(connection => {
          const connectedSpark = state.sparks.find(s => s.id === connection.sparkId2)
          if (connectedSpark) {
            // Only create line once per connection (avoid duplicates)
            if (!lines.some(line =>
              (line.fromSparkId === spark.id && line.toSparkId === connectedSpark.id) ||
              (line.fromSparkId === connectedSpark.id && line.toSparkId === spark.id)
            )) {
              // Calculate connection strength based on XP levels and recency
              const totalXp = spark.xp + connectedSpark.xp
              const avgLevel = (spark.level + connectedSpark.level) / 2
              const daysSinceCreation = Math.max(1,
                (new Date().getTime() - new Date(connection.createdAt).getTime()) / (1000 * 60 * 60 * 24)
              )
              const strength = Math.min(1, (totalXp / 1000 + avgLevel / 10) / Math.sqrt(daysSinceCreation))

              lines.push({
                id: `${spark.id}-${connectedSpark.id}`,
                fromSparkId: spark.id,
                toSparkId: connectedSpark.id,
                fromX: (spark.positionX || Math.random() * 600) + 128, // Center of card (card width is 256/2)
                fromY: (spark.positionY || Math.random() * 400) + 100, // Center of card (approximate height)
                toX: (connectedSpark.positionX || Math.random() * 600) + 128,
                toY: (connectedSpark.positionY || Math.random() * 400) + 100,
                strength,
                connection,
              })
            }
          }
        })
      }
    })

    return lines
  }, [state.sparks])
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event
    const spark = state.sparks.find(s => s.id === active.id)
    setActiveSpark(spark || null)
  }, [state.sparks])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, delta } = event

    const spark = state.sparks.find(s => s.id === active.id)
    if (spark) {
      // Calculate new position based on current position + drag delta
      const newPositionX = Math.max(0, (spark.positionX || 0) + delta.x)
      const newPositionY = Math.max(0, (spark.positionY || 0) + delta.y)

      // Haptic feedback for drag completion
      HapticFeedback.gesture()

      await actions.updateSpark(spark.id, {
        positionX: newPositionX,
        positionY: newPositionY,
      })

      // Broadcast position change to other users
      broadcastSparkChange({
        sparkId: spark.id,
        content: '',
        changeType: 'position',
        position: { x: newPositionX, y: newPositionY }
      })
    }

    setActiveSpark(null)
  }, [state.sparks, actions, broadcastSparkChange])

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    // Only deselect if clicking directly on canvas, not on a spark
    if (e.target === e.currentTarget) {
      actions.selectSpark(null)
    }
  }, [actions])

  // Handle mouse movement for cursor tracking
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      updateCursor(x, y)
    }
  }, [updateCursor])

  // Handle spark selection with collaboration
  const handleSparkClick = useCallback((spark: Spark) => {
    actions.selectSpark(spark)
    startEditingSpark(spark.id)
  }, [actions, startEditingSpark])

  // Handle spark deselection
  useEffect(() => {
    const handleClickOutside = () => {
      if (state.selectedSpark) {
        endEditingSpark(state.selectedSpark.id)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [state.selectedSpark, endEditingSpark])

  // Use filtered sparks from search context, fallback to all sparks if no filtering
  const sparksToDisplay = filteredSparks.length > 0 ? filteredSparks : state.sparks

  const connectionLinesData = connectionLines()

  return (
    <>
      {/* Toolbar */}
      <div className="absolute top-4 right-4 z-40 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleShowRecommendations(state.selectedSpark || state.sparks[0])}
          disabled={state.sparks.length === 0}
          className="bg-background/80 backdrop-blur-sm"
        >
          <Zap className="h-4 w-4 mr-2" />
          Suggestions
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleShowBatchTools}
          disabled={state.sparks.length < 2}
          className="bg-background/80 backdrop-blur-sm"
        >
          <Users className="h-4 w-4 mr-2" />
          Batch Connect
        </Button>
      </div>

      {/* Connection Recommendations Panel */}
      {showRecommendations && (
        <div className="absolute top-4 right-4 z-30">
          <ConnectionRecommendations
            targetSpark={recommendationTarget}
            isVisible={showRecommendations}
            onClose={() => setShowRecommendations(false)}
            onConnectionCreate={handleConnectionCreate}
          />
        </div>
      )}

      {/* Batch Connection Tools Panel */}
      {showBatchTools && (
        <div className="absolute top-4 right-4 z-30">
          <BatchConnectionTools
            isVisible={showBatchTools}
            onClose={() => setShowBatchTools(false)}
          />
        </div>
      )}

      {/* Drag Connection Overlay */}
      <DragConnectionOverlay
        isDragging={isDraggingConnection}
        startPosition={dragStartPosition}
        currentPosition={dragCurrentPosition}
        connectionType={dragConnectionType}
        onTypeChange={setDragConnectionType}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
      <div
        ref={canvasRef}
        className="relative w-full h-full bg-gradient-to-br from-background to-muted/20 overflow-hidden"
        onClick={handleCanvasClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleMouseUp}
        data-project-canvas
        id="spark-canvas"
        style={{
          transform: `translate3d(${canvasTransform.x}px, ${canvasTransform.y}px, 0) scale(${canvasTransform.scale})`,
          transformOrigin: '0 0',
          transition: touchGesture.isActive ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          touchAction: 'none', // Prevent default touch behaviors
        }}
      >
        {/* Background grid pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Connection Lines */}
        <svg className="absolute inset-0" style={{ zIndex: 0 }}>
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
              className="text-primary fill-primary"
            >
              <polygon points="0 0, 10 3.5, 0 7" />
            </marker>
            <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          {connectionLinesData.map((line) => {
            const isHovered = hoveredConnection === line.id
            const strokeWidth = Math.max(2, line.strength * 8)
            const opacity = isHovered ? 0.9 : Math.max(0.3, line.strength * 0.7)

            // Calculate curve control points for smoother connections
            const dx = line.toX - line.fromX
            const dy = line.toY - line.fromY
            const distance = Math.sqrt(dx * dx + dy * dy)
            const curvature = Math.min(50, distance * 0.2)

            const midX = (line.fromX + line.toX) / 2
            const midY = (line.fromY + line.toY) / 2

            // Perpendicular offset for curve
            const perpX = -dy / distance * curvature
            const perpY = dx / distance * curvature

            const controlX = midX + perpX
            const controlY = midY + perpY

            const pathD = `M ${line.fromX} ${line.fromY} Q ${controlX} ${controlY} ${line.toX} ${line.toY}`

            return (
              <g key={line.id}>
                {/* Invisible thick line for easier hover detection */}
                <path
                  d={pathD}
                  stroke="transparent"
                  strokeWidth="20"
                  fill="none"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredConnection(line.id)}
                  onMouseLeave={() => setHoveredConnection(null)}
                  onClick={() => setSelectedConnection(line)}
                  style={{ pointerEvents: 'stroke' }}
                />
                {/* Visible connection line */}
                <path
                  d={pathD}
                  stroke={isHovered ? "hsl(var(--primary))" : "url(#connectionGradient)"}
                  strokeWidth={strokeWidth}
                  strokeOpacity={opacity}
                  fill="none"
                  markerEnd="url(#arrowhead)"
                  className={`transition-all duration-300 ${isHovered ? 'filter drop-shadow-lg' : ''}`}
                  style={{ pointerEvents: 'none' }}
                />
                {/* Connection strength indicator dots */}
                {isHovered && (
                  <g>
                    <circle
                      cx={line.fromX}
                      cy={line.fromY}
                      r={6 + line.strength * 4}
                      fill="hsl(var(--primary))"
                      fillOpacity="0.7"
                      className="animate-pulse"
                    />
                    <circle
                      cx={line.toX}
                      cy={line.toY}
                      r={6 + line.strength * 4}
                      fill="hsl(var(--primary))"
                      fillOpacity="0.7"
                      className="animate-pulse"
                    />
                    {/* Strength indicator at midpoint */}
                    <circle
                      cx={midX}
                      cy={midY}
                      r={4 + line.strength * 6}
                      fill="hsl(var(--primary))"
                      fillOpacity="0.9"
                      className="animate-pulse"
                    />
                  </g>
                )}
              </g>
            )
          })}
        </svg>

        {/* Sparks */}
        {sparksToDisplay.map((spark) => (
          <div
            key={spark.id}
            data-spark-id={spark.id}
            className={`absolute transition-all duration-200 hover:scale-105 ${
              dragTargetSpark?.id === spark.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
            }`}
            style={{
              left: spark.positionX || Math.random() * 600,
              top: spark.positionY || Math.random() * 400,
              transform: state.selectedSpark?.id === spark.id ? 'scale(1.05)' : 'scale(1)',
              zIndex: state.selectedSpark?.id === spark.id ? 10 : 1,
              // Ensure minimum touch target size for mobile accessibility
              minWidth: '44px',
              minHeight: '44px',
            }}
            onMouseDown={(e) => handleSparkMouseDown(e, spark)}
          >
            <DraggableSparkCard
              spark={spark}
              isSelected={state.selectedSpark?.id === spark.id}
              onClick={() => handleSparkClick(spark)}
            />
          </div>
        ))}

        {/* Empty state */}
        {sparksToDisplay.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-1">No sparks yet</h3>
                <p className="text-muted-foreground">Create your first spark to get started!</p>
              </div>
            </div>
          </div>
        )}

        {/* Connection Details Modal */}
        {selectedConnection && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-50">
            <div className="bg-background border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Connection Details</h3>
                <button
                  onClick={() => setSelectedConnection(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Connected Sparks</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: state.sparks.find(s => s.id === selectedConnection.fromSparkId)?.color }}
                      />
                      <span>{state.sparks.find(s => s.id === selectedConnection.fromSparkId)?.title}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="ml-1.5">↓</span>
                      <span>Connected to</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: state.sparks.find(s => s.id === selectedConnection.toSparkId)?.color }}
                      />
                      <span>{state.sparks.find(s => s.id === selectedConnection.toSparkId)?.title}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Connection Strength</h4>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className="bg-primary rounded-full h-2 transition-all duration-300"
                        style={{ width: `${selectedConnection.strength * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{Math.round(selectedConnection.strength * 100)}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Based on combined XP, levels, and connection age
                  </p>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Created</h4>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedConnection.connection.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>

                <div className="pt-4 border-t">
                  <button
                    onClick={() => {
                      // Navigate to connected sparks or perform other actions
                      setSelectedConnection(null)
                    }}
                    className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  >
                    Explore Connection
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Drag overlay */}
        <DragOverlay>
          {activeSpark ? (
            <div className="opacity-80">
              <SparkCard
                spark={activeSpark}
                isSelected={false}
                onClick={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>

        {/* User cursors overlay */}

        {/* Instructions for new users */}
        <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur-sm border rounded-lg px-3 py-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            <span>Hold Shift + Drag to create connections</span>
          </div>
        </div>
      </div>
    </DndContext>
    </>
  )
}


