"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Todo, TodoType, TodoPriority } from "@/types/spark"
import { Plus, X } from "lucide-react"

interface AddTodoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddTodo: (todo: Omit<Todo, "id" | "createdAt">) => Promise<void>
  sparkId: string
}

export function AddTodoDialog({ open, onOpenChange, onAddTodo, sparkId }: AddTodoDialogProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: TodoType.GENERAL,
    priority: TodoPriority.MEDIUM,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title.trim()) return

    setIsSubmitting(true)
    try {
      await onAddTodo({
        sparkId,
        title: formData.title.trim(),
        description: formData.description.trim() || "",
        type: formData.type,
        priority: formData.priority,
        completed: false,
      })
      
      // Reset form
      setFormData({
        title: "",
        description: "",
        type: TodoType.GENERAL,
        priority: TodoPriority.MEDIUM,
      })
      
      onOpenChange(false)
    } catch (error) {
      console.error("Error adding todo:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Todo
          </DialogTitle>
          <DialogDescription>
            Add a new task to help you grow this spark. Todos help you track progress and break down your ideas into actionable steps.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="todo-title">Title *</Label>
            <Input
              id="todo-title"
              placeholder="What needs to be done?"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              required
              className="focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="todo-description">Description (Optional)</Label>
            <Textarea
              id="todo-description"
              placeholder="Add more details about this task..."
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              rows={3}
              className="resize-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="todo-type">Type</Label>
              <Select value={formData.type} onValueChange={(value) => handleInputChange("type", value)}>
                <SelectTrigger id="todo-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GENERAL">General</SelectItem>
                  <SelectItem value="TASK">Task</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="todo-priority">Priority</Label>
              <Select value={formData.priority} onValueChange={(value) => handleInputChange("priority", value)}>
                <SelectTrigger id="todo-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-muted/30 p-3 rounded-lg">
            <div className="text-sm text-muted-foreground">
              <strong>Tip:</strong> Breaking down your spark into smaller todos makes it easier to track progress and stay motivated!
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!formData.title.trim() || isSubmitting}
              className="min-w-[100px]"
            >
              {isSubmitting ? "Adding..." : "Add Todo"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}