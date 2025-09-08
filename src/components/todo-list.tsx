"use client"

import { useState } from "react"
import { useSpark } from "@/contexts/spark-context"
import { Todo, TodoPriority, TodoType } from "@/types/spark"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { 
  Plus, 
  Trash2, 
  Edit, 
  CheckCircle, 
  Circle, 
  Clock,
  AlertTriangle,
  Target,
  MessageSquare
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { CommentSection } from "@/components/ui/comment-section"

interface TodoListProps {
  sparkId: string
  todos: Todo[]
  onTodoUpdate: (todoId: string, updates: Partial<Todo>) => void
  onTodoDelete: (todoId: string) => void
  onTodoAdd: (todo: Omit<Todo, "id" | "createdAt">) => void
  onStatsRefresh?: () => void
}

export function TodoList({ sparkId, todos, onTodoUpdate, onTodoDelete, onTodoAdd, onStatsRefresh }: TodoListProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)
  const [showCommentsFor, setShowCommentsFor] = useState<string | null>(null)
  const [newTodo, setNewTodo] = useState({
    title: "",
    description: "",
    type: TodoType.GENERAL,
    priority: TodoPriority.MEDIUM,
  })

  const handleAddTodo = () => {
    if (newTodo.title.trim()) {
      onTodoAdd({
        sparkId,
        title: newTodo.title.trim(),
        description: newTodo.description.trim() || undefined,
        type: newTodo.type,
        priority: newTodo.priority,
        completed: false,
      })
      setNewTodo({
        title: "",
        description: "",
        type: TodoType.GENERAL,
        priority: TodoPriority.MEDIUM,
      })
      setIsAddDialogOpen(false)
    }
  }

  const handleTodoToggle = (todoId: string, completed: boolean) => {
    onTodoUpdate(todoId, { 
      completed,
      completedAt: completed ? new Date() : undefined 
    })
    // Refresh stats when todo is completed (XP awarded)
    if (completed && onStatsRefresh) {
      onStatsRefresh()
    }
  }

  const getPriorityColor = (priority: TodoPriority) => {
    switch (priority) {
      case TodoPriority.HIGH: return "bg-red-100 text-red-800 border-red-200"
      case TodoPriority.MEDIUM: return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case TodoPriority.LOW: return "bg-green-100 text-green-800 border-green-200"
      default: return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getPriorityIcon = (priority: TodoPriority) => {
    switch (priority) {
      case TodoPriority.HIGH: return <AlertTriangle className="h-3 w-3" />
      case TodoPriority.MEDIUM: return <Clock className="h-3 w-3" />
      case TodoPriority.LOW: return <Target className="h-3 w-3" />
      default: return <Target className="h-3 w-3" />
    }
  }

  const incompleteTodos = todos.filter(todo => !todo.completed)
  const completedTodos = todos.filter(todo => todo.completed)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Todos</h3>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Todo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Todo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="todo-title">Title *</Label>
                <Input
                  id="todo-title"
                  placeholder="Enter todo title..."
                  value={newTodo.title}
                  onChange={(e) => setNewTodo(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="todo-description">Description</Label>
                <Textarea
                  id="todo-description"
                  placeholder="Enter todo description..."
                  value={newTodo.description}
                  onChange={(e) => setNewTodo(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="todo-type">Type</Label>
                  <Select value={newTodo.type} onValueChange={(value) => setNewTodo(prev => ({ ...prev, type: value as TodoType }))}>
                    <SelectTrigger id="todo-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TodoType.GENERAL}>General</SelectItem>
                      <SelectItem value={TodoType.TASK}>Task</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="todo-priority">Priority</Label>
                  <Select value={newTodo.priority} onValueChange={(value) => setNewTodo(prev => ({ ...prev, priority: value as TodoPriority }))}>
                    <SelectTrigger id="todo-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TodoPriority.HIGH}>High</SelectItem>
                      <SelectItem value={TodoPriority.MEDIUM}>Medium</SelectItem>
                      <SelectItem value={TodoPriority.LOW}>Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddTodo} disabled={!newTodo.title.trim()}>
                  Add Todo
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Incomplete Todos */}
      {incompleteTodos.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">To Do ({incompleteTodos.length})</h4>
          {incompleteTodos.map((todo) => (
            <Card key={todo.id} className="p-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={todo.completed}
                  onCheckedChange={(checked) => handleTodoToggle(todo.id, checked as boolean)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h5 className="text-sm font-medium line-clamp-1">{todo.title}</h5>
                    <Badge variant="outline" className={`text-xs ${getPriorityColor(todo.priority)}`}>
                      {getPriorityIcon(todo.priority)}
                      <span className="ml-1">{todo.priority.toLowerCase()}</span>
                    </Badge>
                    {todo.type === TodoType.TASK && (
                      <Badge variant="secondary" className="text-xs">
                        Task
                      </Badge>
                    )}
                  </div>
                  {todo.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {todo.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCommentsFor(showCommentsFor === todo.id ? null : todo.id)}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  >
                    <MessageSquare className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onTodoDelete(todo.id)}
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {showCommentsFor === todo.id && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <CommentSection
                    entityId={todo.id}
                    entityType="TODO"
                    className="text-sm"
                  />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Completed Todos */}
      {completedTodos.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Completed ({completedTodos.length})</h4>
          {completedTodos.map((todo) => (
            <Card key={todo.id} className="p-3 opacity-60">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={todo.completed}
                  onCheckedChange={(checked) => handleTodoToggle(todo.id, checked as boolean)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h5 className="text-sm font-medium line-clamp-1 line-through">
                      {todo.title}
                    </h5>
                    <Badge variant="outline" className={`text-xs ${getPriorityColor(todo.priority)}`}>
                      {getPriorityIcon(todo.priority)}
                      <span className="ml-1">{todo.priority.toLowerCase()}</span>
                    </Badge>
                  </div>
                  {todo.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 line-through">
                      {todo.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCommentsFor(showCommentsFor === todo.id ? null : todo.id)}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  >
                    <MessageSquare className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onTodoDelete(todo.id)}
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {showCommentsFor === todo.id && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <CommentSection
                    entityId={todo.id}
                    entityType="TODO"
                    className="text-sm"
                  />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {todos.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No todos yet. Add one to get started!</p>
        </div>
      )}
    </div>
  )
}