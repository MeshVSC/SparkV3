"use client"

import { useSpark } from "@/contexts/spark-context"
import { useSearch } from "@/contexts/search-context"
import { SparkCard } from "@/components/spark-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CreateSparkDialog } from "@/components/create-spark-dialog"
import { useState } from "react"
import { format } from "date-fns"
import { 
  Calendar, 
  Clock, 
  TrendingUp, 
  Plus,
  Target
} from "lucide-react"

export function TimelineView() {
  const { state, actions } = useSpark()
  const { filteredSparks } = useSearch()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  // Use filtered sparks from search context, fallback to all sparks if no filtering
  const sparksToDisplay = filteredSparks.length > 0 ? filteredSparks : state.sparks

  // Sort sparks by creation date
  const sortedSparks = [...sparksToDisplay].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  // Group sparks by date
  const groupedSparks = sortedSparks.reduce((groups, spark) => {
    const date = format(new Date(spark.createdAt), "yyyy-MM-dd")
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(spark)
    return groups
  }, {} as Record<string, typeof sortedSparks>)

  const getStatusColor = (status: string) => {
    switch (status) {
      case "SEEDLING": return "bg-green-100 text-green-800 border-green-200"
      case "SAPLING": return "bg-blue-100 text-blue-800 border-blue-200"
      case "TREE": return "bg-purple-100 text-purple-800 border-purple-200"
      case "FOREST": return "bg-orange-100 text-orange-800 border-orange-200"
      default: return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const totalXP = sparksToDisplay.reduce((sum, spark) => sum + spark.xp, 0)
  const totalTodos = sparksToDisplay.reduce((sum, spark) => sum + (spark.todos?.length || 0), 0)
  const completedTodos = sparksToDisplay.reduce((sum, spark) => 
    sum + (spark.todos?.filter(todo => todo.completed).length || 0), 0
  )

  return (
    <div className="h-full p-6 overflow-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Timeline</h1>
          <p className="text-muted-foreground">
            Track the evolution of your ideas over time
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Spark
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total XP</p>
                <p className="text-lg font-semibold">{totalXP}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Completed Todos</p>
                <p className="text-lg font-semibold">{completedTodos}/{totalTodos}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Sparks</p>
                <p className="text-lg font-semibold">{sparksToDisplay.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <div className="space-y-8">
        {Object.entries(groupedSparks)
          .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
          .map(([date, sparks]) => (
            <div key={date} className="relative">
              {/* Date header */}
              <div className="sticky top-0 z-10 mb-4">
                <div className="inline-flex items-center gap-2 bg-background px-4 py-2 rounded-lg border">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">
                    {format(new Date(date), "MMMM d, yyyy")}
                  </span>
                  <Badge variant="outline" className="ml-2">
                    {sparks.length} sparks
                  </Badge>
                </div>
              </div>

              {/* Timeline items */}
              <div className="relative pl-8">
                {/* Timeline line */}
                <div className="absolute left-0 top-0 bottom-0 w-px bg-border"></div>
                
                {/* Sparks */}
                <div className="space-y-4">
                  {sparks.map((spark, index) => (
                    <div key={spark.id} className="relative">
                      {/* Timeline dot */}
                      <div className="absolute left-[-16px] top-6 w-8 h-8 bg-background border-2 border-border rounded-full flex items-center justify-center">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                      </div>
                      
                      {/* Spark card */}
                      <div
                        className="cursor-pointer"
                        onClick={() => actions.selectSpark(spark)}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${getStatusColor(spark.status)}`}
                          >
                            {spark.status.toLowerCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(spark.createdAt), "h:mm a")}
                          </span>
                        </div>
                        <SparkCard
                          spark={spark}
                          isSelected={state.selectedSpark?.id === spark.id}
                          onClick={() => actions.selectSpark(spark)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
      </div>

      {sparksToDisplay.length === 0 && (
        <div className="text-center py-16">
          <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No sparks yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first spark to start building your timeline
          </p>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Spark
          </Button>
        </div>
      )}

      <CreateSparkDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  )
}