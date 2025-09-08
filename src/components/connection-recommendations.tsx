"use client"

import { useState, useEffect, useMemo } from "react"
import { Spark, ConnectionType } from "@/types/spark"
import { useSpark } from "@/contexts/spark-context"
import { ContentSimilarityEngine, ConnectionSuggestion } from "@/lib/content-similarity"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { 
  Lightbulb, 
  Link as LinkIcon, 
  ArrowRight, 
  Sparkles, 
  X,
  RefreshCw,
  ThumbsUp,
  ThumbsDown
} from "lucide-react"

interface ConnectionRecommendationsProps {
  targetSpark: Spark | null
  isVisible: boolean
  onClose: () => void
  onConnectionCreate: (spark1Id: string, spark2Id: string, type: ConnectionType) => void
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

export function ConnectionRecommendations({ 
  targetSpark, 
  isVisible, 
  onClose, 
  onConnectionCreate 
}: ConnectionRecommendationsProps) {
  const { state } = useSpark()
  const [suggestions, setSuggestions] = useState<ConnectionSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set())

  const filteredSuggestions = useMemo(() => {
    return suggestions.filter(suggestion => 
      !dismissedSuggestions.has(suggestion.spark.id)
    )
  }, [suggestions, dismissedSuggestions])

  const generateSuggestions = async () => {
    if (!targetSpark) return
    
    setIsLoading(true)
    try {
      // Simulate processing delay for UX
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const newSuggestions = ContentSimilarityEngine.generateConnectionSuggestions(
        targetSpark,
        state.sparks,
        0.15 // Lower threshold for more suggestions
      )
      
      setSuggestions(newSuggestions)
      setDismissedSuggestions(new Set()) // Reset dismissed suggestions
    } catch (error) {
      console.error('Error generating suggestions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isVisible && targetSpark) {
      generateSuggestions()
    }
  }, [isVisible, targetSpark, state.sparks])

  const handleCreateConnection = async (suggestion: ConnectionSuggestion) => {
    if (!targetSpark) return
    
    try {
      await onConnectionCreate(targetSpark.id, suggestion.spark.id, suggestion.suggestedType)
      
      // Remove this suggestion after successful creation
      setDismissedSuggestions(prev => new Set([...prev, suggestion.spark.id]))
    } catch (error) {
      console.error('Error creating connection:', error)
    }
  }

  const handleDismissSuggestion = (sparkId: string) => {
    setDismissedSuggestions(prev => new Set([...prev, sparkId]))
  }

  const getScoreColor = (score: number) => {
    if (score >= 0.7) return "text-green-600 dark:text-green-400"
    if (score >= 0.5) return "text-yellow-600 dark:text-yellow-400"
    return "text-blue-600 dark:text-blue-400"
  }

  const getScoreLabel = (score: number) => {
    if (score >= 0.7) return "High"
    if (score >= 0.5) return "Medium"
    return "Low"
  }

  if (!isVisible || !targetSpark) return null

  return (
    <Card className="w-80 shadow-lg border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Connection Suggestions
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={generateSuggestions}
              disabled={isLoading}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          For: <span className="font-medium">{targetSpark.title}</span>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Analyzing content...</span>
            </div>
          </div>
        ) : filteredSuggestions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {suggestions.length === 0 
                ? "No similar sparks found" 
                : "All suggestions dismissed"
              }
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={generateSuggestions}
              className="mt-2"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Refresh
            </Button>
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <div className="space-y-3">
              {filteredSuggestions.map((suggestion, index) => (
                <div key={suggestion.spark.id}>
                  <Card className="border border-border/50 hover:border-primary/30 transition-colors">
                    <CardContent className="p-4">
                      {/* Spark Info */}
                      <div className="flex items-start gap-3 mb-3">
                        <div
                          className="w-3 h-3 rounded-full shrink-0 mt-1"
                          style={{ backgroundColor: suggestion.spark.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm line-clamp-2 mb-1">
                            {suggestion.spark.title}
                          </h4>
                          {suggestion.spark.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {suggestion.spark.description}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="outline" className="text-xs">
                            Lvl {suggestion.spark.level}
                          </Badge>
                          <div className={`text-xs font-medium ${getScoreColor(suggestion.score)}`}>
                            {getScoreLabel(suggestion.score)}
                          </div>
                        </div>
                      </div>

                      {/* Connection Type & Reason */}
                      <div className="space-y-2 mb-3">
                        <div className="flex items-center gap-2">
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <Badge className={`text-xs ${connectionTypeColors[suggestion.suggestedType]}`}>
                            {connectionTypeLabels[suggestion.suggestedType]}
                          </Badge>
                          <Badge variant="outline" className="text-xs capitalize">
                            {suggestion.matchType}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {suggestion.reason}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDismissSuggestion(suggestion.spark.id)}
                            className="h-7 px-2 text-xs"
                          >
                            <ThumbsDown className="h-3 w-3 mr-1" />
                            Dismiss
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleCreateConnection(suggestion)}
                          className="h-7 px-3 text-xs"
                        >
                          <LinkIcon className="h-3 w-3 mr-1" />
                          Connect
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  {index < filteredSuggestions.length - 1 && (
                    <Separator className="my-2" />
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Stats */}
        {!isLoading && filteredSuggestions.length > 0 && (
          <div className="mt-4 pt-3 border-t text-center">
            <p className="text-xs text-muted-foreground">
              {filteredSuggestions.length} suggestions • Based on content similarity
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}