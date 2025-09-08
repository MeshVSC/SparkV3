"use client"

import { useState, useCallback } from "react"
import { Spark, ConnectionType } from "@/types/spark"
import { useSpark } from "@/contexts/spark-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { 
  Link2, 
  X, 
  Check, 
  Square, 
  CheckSquare, 
  ArrowRight,
  Loader2,
  Network,
  Filter
} from "lucide-react"

interface BatchConnectionToolsProps {
  isVisible: boolean
  onClose: () => void
}

interface ConnectionOperation {
  spark1Id: string
  spark2Id: string
  type: ConnectionType
  spark1Title: string
  spark2Title: string
}

const connectionTypeColors = {
  DEPENDS_ON: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  RELATED_TO: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", 
  INSPIRES: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  CONFLICTS_WITH: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
}

const connectionTypeLabels = {
  DEPENDS_ON: "Depends On",
  RELATED_TO: "Related To", 
  INSPIRES: "Inspires",
  CONFLICTS_WITH: "Conflicts With",
}

export function BatchConnectionTools({ isVisible, onClose }: BatchConnectionToolsProps) {
  const { state, actions } = useSpark()
  const [selectedSparks, setSelectedSparks] = useState<Set<string>>(new Set())
  const [connectionType, setConnectionType] = useState<ConnectionType>(ConnectionType.RELATED_TO)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [filter, setFilter] = useState<string>('ALL')
  const [completedOperations, setCompletedOperations] = useState(0)

  // Filter sparks based on status
  const filteredSparks = state.sparks.filter(spark => {
    if (filter === 'ALL') return true
    return spark.status === filter
  })

  const selectedSparksList = filteredSparks.filter(spark => selectedSparks.has(spark.id))

  // Generate all possible connection combinations
  const generateConnections = useCallback((sparks: Spark[], type: ConnectionType): ConnectionOperation[] => {
    const operations: ConnectionOperation[] = []
    
    for (let i = 0; i < sparks.length; i++) {
      for (let j = i + 1; j < sparks.length; j++) {
        const spark1 = sparks[i]
        const spark2 = sparks[j]
        
        // Check if connection already exists
        const connectionExists = spark1.connections?.some(conn => 
          (conn.sparkId1 === spark2.id || conn.sparkId2 === spark2.id)
        ) || spark2.connections?.some(conn => 
          (conn.sparkId1 === spark1.id || conn.sparkId2 === spark1.id)
        )
        
        if (!connectionExists) {
          operations.push({
            spark1Id: spark1.id,
            spark2Id: spark2.id,
            type,
            spark1Title: spark1.title,
            spark2Title: spark2.title
          })
        }
      }
    }
    
    return operations
  }, [])

  const handleSparkToggle = (sparkId: string) => {
    setSelectedSparks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sparkId)) {
        newSet.delete(sparkId)
      } else {
        newSet.add(sparkId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (selectedSparks.size === filteredSparks.length) {
      setSelectedSparks(new Set())
    } else {
      setSelectedSparks(new Set(filteredSparks.map(spark => spark.id)))
    }
  }

  const handleSelectByStatus = (status: string) => {
    const sparksByStatus = filteredSparks.filter(spark => spark.status === status)
    setSelectedSparks(new Set(sparksByStatus.map(spark => spark.id)))
  }

  const handleCreateConnections = async () => {
    if (selectedSparksList.length < 2) return

    setIsProcessing(true)
    setProgress(0)
    setCompletedOperations(0)

    const operations = generateConnections(selectedSparksList, connectionType)
    
    try {
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i]
        
        await actions.createSparkConnection(
          operation.spark1Id,
          operation.spark2Id,
          operation.type
        )
        
        setCompletedOperations(i + 1)
        setProgress(((i + 1) / operations.length) * 100)
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    } catch (error) {
      console.error('Error creating batch connections:', error)
    } finally {
      setIsProcessing(false)
      setSelectedSparks(new Set()) // Clear selection after completion
    }
  }

  const estimatedConnections = selectedSparksList.length > 1 
    ? generateConnections(selectedSparksList, connectionType).length 
    : 0

  if (!isVisible) return null

  return (
    <Card className="w-96 shadow-lg border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Network className="h-5 w-5 text-primary" />
            Batch Connections
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-sm text-muted-foreground">
          Create connections between multiple sparks simultaneously
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filter Controls */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Sparks</SelectItem>
              <SelectItem value="SEEDLING">Seedlings</SelectItem>
              <SelectItem value="SAPLING">Saplings</SelectItem>
              <SelectItem value="TREE">Trees</SelectItem>
              <SelectItem value="FOREST">Forests</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Selection Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedSparks.size === filteredSparks.length && filteredSparks.length > 0}
              onCheckedChange={handleSelectAll}
              ref={(el) => {
                if (el) el.indeterminate = selectedSparks.size > 0 && selectedSparks.size < filteredSparks.length
              }}
            />
            <span className="text-sm font-medium">
              Select All ({selectedSparks.size}/{filteredSparks.length})
            </span>
          </div>
        </div>

        {/* Quick Selection Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSelectByStatus('SEEDLING')}
            className="text-xs"
          >
            All Seedlings
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSelectByStatus('SAPLING')}
            className="text-xs"
          >
            All Saplings
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSelectByStatus('TREE')}
            className="text-xs"
          >
            All Trees
          </Button>
        </div>

        <Separator />

        {/* Spark Selection List */}
        <ScrollArea className="max-h-64">
          <div className="space-y-2">
            {filteredSparks.map((spark) => (
              <div
                key={spark.id}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                onClick={() => handleSparkToggle(spark.id)}
              >
                <Checkbox
                  checked={selectedSparks.has(spark.id)}
                  onCheckedChange={() => handleSparkToggle(spark.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: spark.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm line-clamp-1">
                    {spark.title}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {spark.status.toLowerCase()}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Lvl {spark.level}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <Separator />

        {/* Connection Type Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Connection Type</label>
          <Select 
            value={connectionType} 
            onValueChange={(value) => setConnectionType(value as ConnectionType)}
            disabled={isProcessing}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(connectionTypeLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <Badge className={connectionTypeColors[key as ConnectionType]}>
                      {label}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Processing Progress */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Creating connections...</span>
              <span>{completedOperations}/{estimatedConnections}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Summary and Actions */}
        <div className="space-y-3">
          {selectedSparksList.length > 1 && !isProcessing && (
            <Card className="bg-muted/50 border-dashed">
              <CardContent className="p-3">
                <div className="text-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Selected Sparks:</span>
                    <Badge variant="secondary">{selectedSparksList.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Estimated Connections:</span>
                    <Badge variant="secondary">{estimatedConnections}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Connection Type:</span>
                    <Badge className={connectionTypeColors[connectionType]}>
                      {connectionTypeLabels[connectionType]}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setSelectedSparks(new Set())}
              disabled={selectedSparks.size === 0 || isProcessing}
            >
              Clear Selection
            </Button>
            <Button
              onClick={handleCreateConnections}
              disabled={selectedSparksList.length < 2 || isProcessing}
              className="min-w-[120px]"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  Create Links
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Instructions */}
        <div className="text-xs text-muted-foreground text-center border-t pt-3">
          Select 2+ sparks to create connections between all combinations
        </div>
      </CardContent>
    </Card>
  )
}