"use client"

import { useState } from "react"
import { Spark } from "@/types/spark"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle,
  Circle,
  Plus,
  Target,
  Zap,
  MessageSquare
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSpark } from "@/contexts/spark-context"
import { SparkDetailDialog } from "@/components/spark-detail-dialog"
import { CommentSection } from "@/components/ui/comment-section"
// import { SparkCollaborationIndicator } from "@/components/collaboration/spark-collaboration-indicator"

interface SparkCardProps {
  spark: Spark
  isSelected?: boolean
  onClick?: () => void
  isDragging?: boolean
  style?: React.CSSProperties
}

export function SparkCard({ spark, isSelected = false, onClick, isDragging = false, style }: SparkCardProps) {
  const { actions } = useSpark()
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [showTodos, setShowTodos] = useState(false)
  const [showComments, setShowComments] = useState(false)

  const getStatusColor = (status: string) => {
    switch (status) {
      case "SEEDLING": return "bg-green-100 text-green-800 border-green-200"
      case "SAPLING": return "bg-blue-100 text-blue-800 border-blue-200"
      case "TREE": return "bg-purple-100 text-purple-800 border-purple-200"
      case "FOREST": return "bg-orange-100 text-orange-800 border-orange-200"
      default: return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "SEEDLING": return "🌱"
      case "SAPLING": return "🌿"
      case "TREE": return "🌳"
      case "FOREST": return "🌲"
      default: return "💡"
    }
  }

  const completedTodos = spark.todos?.filter(todo => todo.completed).length || 0
  const totalTodos = spark.todos?.length || 0
  const progressPercentage = totalTodos > 0 ? (completedTodos / totalTodos) * 100 : 0

  const getLevelProgress = () => {
    return (spark.xp % 100) / 100 * 100
  }

  const handleQuickTodoComplete = async (todoId: string, completed: boolean) => {
    await actions.updateTodo(spark.id, todoId, { completed })
    // Refresh user stats after XP award
    actions.loadUserStats()
  }

  const handleDelete = async () => {
    await actions.deleteSpark(spark.id)
  }

  return (
    <>
      <Card
        className={`
          kanban-card w-64 shadow-lg transition-all duration-200 cursor-pointer touch-manipulation touch-feedback
          ${isSelected ? 'ring-2 ring-primary shadow-xl' : 'hover:shadow-xl active:shadow-2xl active:scale-[1.02]'}
          ${isDragging ? 'touch-drag-active opacity-90' : 'drag-transition'}
          border-l-4 touch:w-full touch:max-w-none touch:shadow-md touch-card
        `}
        style={{ ...(style || {}), borderLeftColor: spark.color, touchAction: 'manipulation' }}
        onClick={onClick}
      >
        <CardHeader className="pb-2 touch:pb-3 touch:p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0 touch:gap-3">
              <span className="text-lg touch:text-xl">{getStatusIcon(spark.status)}</span>
              <h3 className="font-medium text-sm line-clamp-1 flex-1 touch:text-base touch:font-semibold">
                {spark.title}
              </h3>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 touch:h-10 touch:w-10 touch:min-h-[44px] touch:min-w-[44px]"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Spark options menu"
                >
                  <MoreVertical className="h-3 w-3 touch:h-4 touch:w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="touch:min-w-[200px]">
                <DropdownMenuItem
                  onClick={() => setShowDetailDialog(true)}
                  className="touch:py-3 touch:px-4 touch:text-base"
                >
                  <Edit className="h-3 w-3 mr-2 touch:h-4 touch:w-4 touch:mr-3" />
                  Edit Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowTodos(!showTodos)}
                  className="touch:py-3 touch:px-4 touch:text-base"
                >
                  <Target className="h-3 w-3 mr-2 touch:h-4 touch:w-4 touch:mr-3" />
                  {showTodos ? 'Hide' : 'Show'} Todos
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowComments(!showComments)}
                  className="touch:py-3 touch:px-4 touch:text-base"
                >
                  <MessageSquare className="h-3 w-3 mr-2 touch:h-4 touch:w-4 touch:mr-3" />
                  {showComments ? 'Hide' : 'Show'} Comments
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-destructive touch:py-3 touch:px-4 touch:text-base"
                >
                  <Trash2 className="h-3 w-3 mr-2 touch:h-4 touch:w-4 touch:mr-3" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 touch:gap-3 touch:mt-2">
              <Badge
                variant="secondary"
                className={`text-xs touch:text-sm touch:py-1 touch:px-2 ${getStatusColor(spark.status)}`}
              >
                {spark.status.toLowerCase()}
              </Badge>
              <Badge variant="outline" className="text-xs touch:text-sm touch:py-1 touch:px-2">
                Lvl {spark.level}
              </Badge>
            </div>

            {/* Collaboration indicator */}
            {/* <SparkCollaborationIndicator sparkId={spark.id} /> */}
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-3 touch:space-y-4 touch:px-4 touch:pb-4">
          {spark.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 touch:text-sm touch:leading-relaxed">
              {spark.description}
            </p>
          )}

          {/* XP Progress */}
          <div className="space-y-1 touch:space-y-2">
            <div className="flex justify-between text-xs touch:text-sm">
              <span className="text-muted-foreground">Level Progress</span>
              <span>{spark.xp % 100}/100 XP</span>
            </div>
            <Progress value={getLevelProgress()} className="h-1 touch:h-2" />
          </div>

          {/* Todo Progress */}
          {totalTodos > 0 && (
            <div className="space-y-1 touch:space-y-2">
              <div className="flex justify-between text-xs touch:text-sm">
                <span className="text-muted-foreground">Todos</span>
                <span>{completedTodos}/{totalTodos}</span>
              </div>
              <Progress value={progressPercentage} className="h-1 touch:h-2" />
            </div>
          )}

          {/* Quick Todos */}
          {showTodos && spark.todos && spark.todos.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto touch:space-y-2 touch:max-h-40">
              {spark.todos.slice(0, 3).map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-center gap-2 text-xs touch:gap-3 touch:text-sm touch:py-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 touch:h-8 touch:w-8 touch:min-h-[32px] touch:min-w-[32px]"
                    onClick={() => handleQuickTodoComplete(todo.id, !todo.completed)}
                    aria-label={todo.completed ? "Mark todo as incomplete" : "Mark todo as complete"}
                  >
                    {todo.completed ? (
                      <CheckCircle className="h-3 w-3 text-green-600 touch:h-4 touch:w-4" />
                    ) : (
                      <Circle className="h-3 w-3 text-gray-400 touch:h-4 touch:w-4" />
                    )}
                  </Button>
                  <span className={`line-clamp-1 ${todo.completed ? 'line-through text-muted-foreground' : ''}`}>
                    {todo.title}
                  </span>
                </div>
              ))}
              {spark.todos.length > 3 && (
                <div className="text-xs text-muted-foreground pl-6 touch:text-sm touch:pl-8">
                  +{spark.todos.length - 3} more...
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          {spark.tags && (
            <div className="flex flex-wrap gap-1 touch:gap-2">
              {JSON.parse(spark.tags).slice(0, 2).map((tag: string, index: number) => (
                <Badge key={index} variant="outline" className="text-xs touch:text-sm touch:py-1 touch:px-2">
                  {tag}
                </Badge>
              ))}
              {JSON.parse(spark.tags).length > 2 && (
                <Badge variant="outline" className="text-xs touch:text-sm touch:py-1 touch:px-2">
                  +{JSON.parse(spark.tags).length - 2}
                </Badge>
              )}
            </div>
          )}

          {/* Comments Section */}
          {showComments && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <CommentSection
                entityId={spark.id}
                entityType="SPARK"
                className="touch:text-sm"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <SparkDetailDialog
        spark={spark}
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
      />
    </>
  )
}
