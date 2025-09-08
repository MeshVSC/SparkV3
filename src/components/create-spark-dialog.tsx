"use client"

import { useState, useEffect } from "react"
import { useSpark } from "@/contexts/spark-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SparkStatus } from "@/types/spark"

interface CreateSparkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialStatus?: SparkStatus
}

export function CreateSparkDialog({ open, onOpenChange, initialStatus }: CreateSparkDialogProps) {
  const { actions } = useSpark()
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: initialStatus || SparkStatus.SEEDLING,
    color: "#10b981",
    tags: "",
  })

  // Handle touch events for dismiss gestures
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      // Allow tap-outside-to-close on mobile
      onOpenChange(false)
    }
  }

  // Prevent zoom on double tap for iOS
  useEffect(() => {
    const viewport = document.querySelector('meta[name=viewport]')
    if (viewport) {
      const originalContent = viewport.getAttribute('content')
      viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
      
      return () => {
        if (originalContent) {
          viewport.setAttribute('content', originalContent)
        }
      }
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title.trim()) return

    const sparkData = {
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      status: formData.status,
      xp: 0,
      level: 1,
      color: formData.color,
      tags: formData.tags.trim() || undefined,
      positionX: Math.random() * 500,
      positionY: Math.random() * 500,
    }

    try {
      await actions.createSpark(sparkData)
      
      // Refresh user stats after XP award
      actions.loadUserStats()
      
      // Reset form
      setFormData({
        title: "",
        description: "",
        status: SparkStatus.SEEDLING,
        color: "#10b981",
        tags: "",
      })
      
      onOpenChange(false)
    } catch (error) {
      console.error("Error creating spark:", error)
      
      // Handle authentication errors
      if (error instanceof Error && error.message.includes("Authentication required")) {
        alert("Please sign in to create sparks. Redirecting to sign-in page...")
        setTimeout(() => {
          window.location.href = '/auth/signin'
        }, 1000)
      } else {
        alert("Failed to create spark. Please try again.")
      }
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const colorOptions = [
    { name: "Green", value: "#10b981" },
    { name: "Blue", value: "#3b82f6" },
    { name: "Purple", value: "#8b5cf6" },
    { name: "Pink", value: "#ec4899" },
    { name: "Orange", value: "#f97316" },
    { name: "Red", value: "#ef4444" },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[425px] touch:p-6 touch:gap-6"
        onTouchStart={handleTouchStart}
      >
        <DialogHeader className="touch:mb-4">
          <DialogTitle className="touch:text-lg">Create New Spark</DialogTitle>
          <DialogDescription className="touch:text-base touch:leading-relaxed">
            Create a new spark to capture your ideas and start growing them into reality.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 touch:space-y-6">
          <div className="space-y-2 touch:space-y-3">
            <Label htmlFor="title" className="touch:text-base">Title *</Label>
            <Input
              id="title"
              name="title"
              placeholder="Enter spark title..."
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              required
              autoComplete="off"
              inputMode="text"
            />
          </div>

          <div className="space-y-2 touch:space-y-3">
            <Label htmlFor="description" className="touch:text-base">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Describe your spark..."
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              rows={3}
              inputMode="text"
            />
          </div>

          <div className="space-y-2 touch:space-y-3">
            <Label htmlFor="status" className="touch:text-base">Status</Label>
            <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
              <SelectTrigger id="status" className="touch:min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SparkStatus.SEEDLING}>🌱 Seedling</SelectItem>
                <SelectItem value={SparkStatus.SAPLING}>🌿 Sapling</SelectItem>
                <SelectItem value={SparkStatus.TREE}>🌳 Tree</SelectItem>
                <SelectItem value={SparkStatus.FOREST}>🌲 Forest</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 touch:space-y-3">
            <Label className="touch:text-base">Color</Label>
            <div className="flex gap-3 flex-wrap touch:gap-4">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  className={`w-10 h-10 rounded-full border-2 transition-all touch:w-12 touch:h-12 touch:min-w-[44px] touch:min-h-[44px] ${
                    formData.color === color.value 
                      ? "border-primary ring-2 ring-primary/20 scale-110" 
                      : "border-gray-300 hover:border-gray-400 active:scale-95"
                  }`}
                  style={{ backgroundColor: color.value }}
                  onClick={() => handleInputChange("color", color.value)}
                  title={color.name}
                  aria-label={`Select ${color.name} color`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2 touch:space-y-3">
            <Label htmlFor="tags" className="touch:text-base">Tags</Label>
            <Input
              id="tags"
              name="tags"
              placeholder="Enter tags separated by commas..."
              value={formData.tags}
              onChange={(e) => handleInputChange("tags", e.target.value)}
              autoComplete="off"
              inputMode="text"
            />
          </div>

          <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-end touch:pt-6 touch:gap-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="touch:w-full sm:touch:w-auto"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!formData.title.trim()}
              className="touch:w-full sm:touch:w-auto"
            >
              Create Spark
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}