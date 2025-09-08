"use client"

import { useState, useEffect } from "react"
import { ConnectionType } from "@/types/spark"
import { Badge } from "@/components/ui/badge"

interface DragConnectionOverlayProps {
  isDragging: boolean
  startPosition: { x: number; y: number } | null
  currentPosition: { x: number; y: number } | null
  connectionType: ConnectionType
  onTypeChange: (type: ConnectionType) => void
}

const connectionTypeColors = {
  DEPENDS_ON: "bg-red-500",
  RELATED_TO: "bg-blue-500", 
  INSPIRES: "bg-green-500",
  CONFLICTS_WITH: "bg-orange-500",
}

const connectionTypeLabels = {
  DEPENDS_ON: "Depends On",
  RELATED_TO: "Related To", 
  INSPIRES: "Inspires",
  CONFLICTS_WITH: "Conflicts With",
}

export function DragConnectionOverlay({ 
  isDragging, 
  startPosition, 
  currentPosition, 
  connectionType,
  onTypeChange 
}: DragConnectionOverlayProps) {
  const [showTypeSelector, setShowTypeSelector] = useState(false)

  // Show type selector after a short drag
  useEffect(() => {
    if (isDragging && startPosition && currentPosition) {
      const distance = Math.sqrt(
        Math.pow(currentPosition.x - startPosition.x, 2) + 
        Math.pow(currentPosition.y - startPosition.y, 2)
      )
      
      if (distance > 50) {
        setShowTypeSelector(true)
      }
    } else {
      setShowTypeSelector(false)
    }
  }, [isDragging, startPosition, currentPosition])

  if (!isDragging || !startPosition || !currentPosition) return null

  const lineColor = connectionTypeColors[connectionType]

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {/* Connection Line */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <marker
            id="drag-arrow"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              className={lineColor.replace('bg-', 'fill-')}
            />
          </marker>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Main line with glow effect */}
        <line
          x1={startPosition.x}
          y1={startPosition.y}
          x2={currentPosition.x}
          y2={currentPosition.y}
          className={lineColor.replace('bg-', 'stroke-')}
          strokeWidth="3"
          strokeDasharray="8,4"
          markerEnd="url(#drag-arrow)"
          filter="url(#glow)"
          opacity="0.8"
        />
        
        {/* Pulse animation at start point */}
        <circle
          cx={startPosition.x}
          cy={startPosition.y}
          r="8"
          className={lineColor.replace('bg-', 'fill-')}
          opacity="0.6"
        >
          <animate
            attributeName="r"
            values="6;12;6"
            dur="1.5s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.8;0.3;0.8"
            dur="1.5s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>

      {/* Connection Type Selector */}
      {showTypeSelector && (
        <div
          className="absolute bg-background/95 backdrop-blur-sm border rounded-lg p-3 shadow-lg pointer-events-auto"
          style={{
            left: Math.min(startPosition.x, currentPosition.x) + Math.abs(currentPosition.x - startPosition.x) / 2 - 100,
            top: Math.min(startPosition.y, currentPosition.y) + Math.abs(currentPosition.y - startPosition.y) / 2 - 60,
          }}
        >
          <div className="text-xs font-medium text-muted-foreground mb-2 text-center">
            Connection Type
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(connectionTypeLabels).map(([key, label]) => (
              <button
                key={key}
                onClick={() => onTypeChange(key as ConnectionType)}
                className={`
                  px-2 py-1 rounded text-xs font-medium transition-all
                  ${connectionType === key 
                    ? `${connectionTypeColors[key as ConnectionType].replace('bg-', 'bg-')} text-white ring-2 ring-offset-2 ring-offset-background ring-current` 
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
                  }
                `}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-background/95 backdrop-blur-sm border rounded-lg px-4 py-2 shadow-lg">
        <div className="text-sm text-center">
          <span className="font-medium">Drag to connect sparks</span>
          <div className="text-xs text-muted-foreground mt-1">
            Release on target spark to create connection
          </div>
        </div>
      </div>
    </div>
  )
}