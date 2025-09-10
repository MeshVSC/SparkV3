"use client"

import { useState, useEffect } from "react"
import { useSpark } from "@/contexts/spark-context"
import { Spark } from "@/types/spark"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { FileUploader } from "@/components/file-uploader"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { SparkStatus } from "@/types/spark"
import { AddTodoDialog } from "@/components/add-todo-dialog"
import { X, Link, Link2, Plus, Target } from "lucide-react"
import {
  MDXEditor,
  type MDXEditorMethods,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  imagePlugin,
  tablePlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CreateLink,
  InsertImage,
  ListsToggle,
  InsertTable,
} from "@mdxeditor/editor"
import "@mdxeditor/editor/style.css"

interface SparkDetailDialogProps {
  spark: Spark
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SparkDetailDialog({ spark, open, onOpenChange }: SparkDetailDialogProps) {
  const { state, actions } = useSpark()
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    content: "",
    status: SparkStatus.SEEDLING,
    color: "#10b981",
    tags: [] as string[],
  })
  const [editorRef, setEditorRef] = useState<MDXEditorMethods | null>(null)
  const [showConnectionDialog, setShowConnectionDialog] = useState(false)
  const [selectedSparkToConnect, setSelectedSparkToConnect] = useState<string>("")
  const [showTodoDialog, setShowTodoDialog] = useState(false)

  useEffect(() => {
    if (spark) {
      setFormData({
        title: spark.title,
        description: spark.description || "",
        content: spark.content || "",
        status: spark.status,
        color: spark.color,
        tags: spark.tags ? JSON.parse(spark.tags) : [],
      })
    }
  }, [spark])

  // Handle touch events for dismiss gestures
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      // Allow tap-outside-to-close on mobile
      onOpenChange(false)
    }
  }

  // Prevent zoom on double tap for iOS
  useEffect(() => {
    if (!open) return

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

    const updates = {
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      content: formData.content.trim() || undefined,
      status: formData.status,
      color: formData.color,
      tags: formData.tags.length > 0 ? JSON.stringify(formData.tags) : undefined,
    }

    await actions.updateSpark(spark.id, updates)
    onOpenChange(false)
  }

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const addTag = (tag: string) => {
    if (tag.trim() && !formData.tags.includes(tag.trim())) {
      handleInputChange("tags", [...formData.tags, tag.trim()])
    }
  }

  const removeTag = (tagToRemove: string) => {
    handleInputChange("tags", formData.tags.filter(tag => tag !== tagToRemove))
  }

  const handleTagKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      addTag((e.target as HTMLInputElement).value)
      ;(e.target as HTMLInputElement).value = ""
    }
  }

  const handleConnectSpark = async () => {
    if (!selectedSparkToConnect) return

    try {
      const response = await fetch("/api/mcp/connections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sparkId1: spark.id,
          sparkId2: selectedSparkToConnect,
        }),
      })

      if (response.ok) {
        // Refresh sparks to get updated connections
        await actions.loadSparks()
        setShowConnectionDialog(false)
        setSelectedSparkToConnect("")
      }
    } catch (error) {
      console.error("Error connecting sparks:", error)
    }
  }

  const getConnectedSparks = (): Spark[] => {
    if (!spark.connections) return []
    return spark.connections
      .map(connection => state.sparks.find(s => s.id === connection.sparkId2))
      .filter((s): s is Spark => Boolean(s))
  }

  const getAvailableSparksToConnect = () => {
    return state.sparks.filter(s =>
      s.id !== spark.id &&
      !getConnectedSparks().some(connected => connected.id === s.id)
    )
  }

  const colorOptions = [
    { name: "Green", value: "#10b981" },
    { name: "Blue", value: "#3b82f6" },
    { name: "Purple", value: "#8b5cf6" },
    { name: "Pink", value: "#ec4899" },
    { name: "Orange", value: "#f97316" },
    { name: "Red", value: "#ef4444" },
  ]

  if (!spark) return null

  const connectedSparks = getConnectedSparks()
  const availableSparks = getAvailableSparksToConnect()

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-[800px] max-h-[85vh] overflow-y-auto touch:p-6 touch:gap-6"
          onTouchStart={handleTouchStart}
        >
          <DialogHeader className="touch:mb-4">
            <DialogTitle className="touch:text-lg">Edit Spark Details</DialogTitle>
            <DialogDescription className="touch:text-base touch:leading-relaxed">
              Update your spark's information, content, and settings. Changes are saved automatically.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 touch:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 touch:gap-6">
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
            </div>

            <div className="space-y-2 touch:space-y-3">
              <Label htmlFor="description" className="touch:text-base">Description</Label>
              <Input
                id="description"
                name="description"
                placeholder="Describe your spark..."
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                autoComplete="off"
                inputMode="text"
              />
            </div>

            <div className="space-y-2 touch:space-y-3">
              <Label htmlFor="content" className="touch:text-base">Content</Label>
              <div className="border rounded-md overflow-hidden touch:min-h-[300px]">
                <MDXEditor
                  ref={setEditorRef}
                  markdown={formData.content}
                  onChange={(markdown) => handleInputChange("content", markdown || "")}
                  plugins={[
                    headingsPlugin(),
                    listsPlugin(),
                    quotePlugin(),
                    thematicBreakPlugin(),
                    markdownShortcutPlugin(),
                    linkPlugin(),
                    linkDialogPlugin(),
                    imagePlugin(),
                    tablePlugin(),
                    toolbarPlugin({
                      toolbarContents: () => (
                        <>
                          <UndoRedo />
                          <BoldItalicUnderlineToggles />
                          <BlockTypeSelect />
                          <CreateLink />
                          <ListsToggle />
                          <InsertImage />
                          <InsertTable />
                        </>
                      ),
                    }),
                  ]}
                  contentEditableClassName="prose max-w-full min-h-[200px] p-4 focus:outline-none touch:min-h-[250px] touch:text-[16px] touch:leading-relaxed"
                />
              </div>
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

            {/* Connections Section */}
            <div className="space-y-2 touch:space-y-4">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 touch:text-base">
                  <Link2 className="w-4 h-4 touch:w-5 touch:h-5" />
                  Connected Sparks
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowConnectionDialog(true)}
                  disabled={availableSparks.length === 0}
                  className="touch:min-h-[44px]"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Connect
                </Button>
              </div>

              {connectedSparks.length > 0 ? (
                <div className="flex flex-wrap gap-2 touch:gap-3">
                  {connectedSparks.map((connectedSpark) => (
                    <Badge key={connectedSpark.id} variant="secondary" className="text-sm touch:text-base touch:py-2 touch:px-3">
                      <Link className="w-3 h-3 mr-1 touch:w-4 touch:h-4" />
                      {connectedSpark.title}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground touch:text-base">No connections yet. Connect this spark to related ideas!</p>
              )}
            </div>

            {/* Todos Section */}
            <div className="space-y-2 touch:space-y-4">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 touch:text-base">
                  <Target className="w-4 h-4 touch:w-5 touch:h-5" />
                  Todos
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTodoDialog(true)}
                  className="touch:min-h-[44px]"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Todo
                </Button>
              </div>

              {spark.todos && spark.todos.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto touch:max-h-60 touch:space-y-3">
                  {spark.todos.map((todo) => (
                    <div key={todo.id} className="flex items-center gap-2 p-2 border rounded touch:p-4 touch:gap-4 touch:min-h-[44px]">
                      <input
                        type="checkbox"
                        checked={todo.completed}
                        onChange={(e) => actions.updateTodo(spark.id, todo.id, { completed: e.target.checked })}
                        className="rounded touch:w-5 touch:h-5"
                      />
                      <span className={`flex-1 text-sm touch:text-base ${todo.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {todo.title}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => actions.deleteTodo(spark.id, todo.id)}
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive touch:h-10 touch:w-10 touch:min-h-[44px] touch:min-w-[44px]"
                        aria-label="Delete todo"
                      >
                        <X className="h-3 w-3 touch:h-4 touch:w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground touch:text-base">No todos yet. Add one to get started!</p>
              )}
            </div>

            <div className="space-y-2 touch:space-y-3">
              <Label className="touch:text-base">Tags</Label>
              <div className="flex flex-wrap gap-2 mb-2 touch:gap-3 touch:mb-4">
                {formData.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-sm touch:text-base touch:py-2 touch:px-3">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1 hover:text-destructive touch:ml-2 touch:min-h-[20px] touch:min-w-[20px]"
                      aria-label={`Remove ${tag} tag`}
                    >
                      <X className="h-3 w-3 touch:h-4 touch:w-4" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Input
                placeholder="Add tags (press Enter)..."
                onKeyPress={handleTagKeyPress}
                autoComplete="off"
                inputMode="text"
              />
            </div>

            <div className="bg-muted/50 p-4 rounded-lg touch:p-6">
              <div className="grid grid-cols-3 gap-4 text-sm touch:text-base touch:gap-6">
                <div>
                  <div className="text-muted-foreground">Level</div>
                  <div className="font-medium">{spark.level}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">XP</div>
                  <div className="font-medium">{spark.xp}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Todos</div>
                  <div className="font-medium">{spark.todos?.length || 0}</div>
                </div>
              </div>
            </div>

            {/* File Upload Section */}
            <div className="space-y-2 touch:space-y-3">
              <Label className="touch:text-base">Attachments</Label>
              <FileUploader
                sparkId={spark.id}
                attachments={spark.attachments || []}
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
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Connection Dialog */}
      <Dialog open={showConnectionDialog} onOpenChange={setShowConnectionDialog}>
        <DialogContent className="sm:max-w-[400px] touch:p-6">
          <DialogHeader className="touch:mb-4">
            <DialogTitle className="touch:text-lg">Connect to Another Spark</DialogTitle>
            <DialogDescription className="touch:text-base touch:leading-relaxed">
              Create a connection between related sparks to build a network of ideas and track their relationships.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 touch:space-y-6">
            <div className="space-y-2 touch:space-y-3">
              <Label className="touch:text-base">Select a spark to connect with</Label>
              <Select value={selectedSparkToConnect} onValueChange={setSelectedSparkToConnect}>
                <SelectTrigger className="touch:min-h-[44px]">
                  <SelectValue placeholder="Choose a spark..." />
                </SelectTrigger>
                <SelectContent>
                  {availableSparks.map((availableSpark) => (
                    <SelectItem key={availableSpark.id} value={availableSpark.id}>
                      {availableSpark.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end touch:gap-4">
              <Button
                variant="outline"
                onClick={() => setShowConnectionDialog(false)}
                className="touch:w-full sm:touch:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConnectSpark}
                disabled={!selectedSparkToConnect}
                className="touch:w-full sm:touch:w-auto"
              >
                Connect
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Todo Dialog */}
      <AddTodoDialog
        open={showTodoDialog}
        onOpenChange={setShowTodoDialog}
        onAddTodo={(todoData) => actions.addTodo(spark.id, todoData)}
        sparkId={spark.id}
      />
    </>
  )
}
