"use client"

import React, { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Trash2,
  Copy,
  SkipForward,
  Lightbulb,
  ListTodo,
  X
} from "lucide-react"
import { Spark, Todo, SparkStatus, TodoType, TodoPriority } from "@/types/spark"
import { useSpark } from "@/contexts/spark-context"
import { useToast } from "@/hooks/use-toast"

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ImportedData {
  sparks: Spark[]
  todos: Todo[]
  version?: string
  exportedAt?: string
  projectName?: string
}

interface ImportItem {
  id: string
  type: 'spark' | 'todo'
  data: Spark | Todo
  selected: boolean
  conflict: 'none' | 'duplicate' | 'existing'
  resolution: 'skip' | 'overwrite' | 'duplicate'
}

interface ConflictResolution {
  [itemId: string]: 'skip' | 'overwrite' | 'duplicate'
}

const CONFLICT_ACTIONS = {
  skip: { label: 'Skip', icon: SkipForward, description: 'Skip importing this item' },
  overwrite: { label: 'Overwrite', icon: Trash2, description: 'Replace existing item' },
  duplicate: { label: 'Duplicate', icon: Copy, description: 'Create a copy with new ID' }
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const { state, actions } = useSpark()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [step, setStep] = useState<'upload' | 'preview' | 'conflicts' | 'importing'>('upload')
  const [importedData, setImportedData] = useState<ImportedData | null>(null)
  const [importItems, setImportItems] = useState<ImportItem[]>([])
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [conflictResolutions, setConflictResolutions] = useState<ConflictResolution>({})
  const [isProcessing, setIsProcessing] = useState(false)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/json') {
      toast({
        title: 'Invalid File Type',
        description: 'Please select a JSON file.',
        variant: 'destructive'
      })
      return
    }

    setIsProcessing(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text) as ImportedData

      // Validate the imported data structure
      if (!data.sparks && !data.todos) {
        throw new Error('Invalid file format. Expected sparks and/or todos data.')
      }

      // Prepare import items and detect conflicts
      const items: ImportItem[] = []
      const allSelected = new Set<string>()
      
      // Process sparks
      if (data.sparks) {
        for (const spark of data.sparks) {
          const existingSpark = state.sparks.find(s => s.id === spark.id)
          const conflict = existingSpark ? 'existing' : 'none'
          
          const item: ImportItem = {
            id: `spark-${spark.id}`,
            type: 'spark',
            data: spark,
            selected: true,
            conflict,
            resolution: conflict === 'existing' ? 'skip' : 'duplicate'
          }
          
          items.push(item)
          allSelected.add(item.id)
        }
      }

      // Process todos
      if (data.todos) {
        for (const todo of data.todos) {
          // Find existing todo across all sparks
          const existingTodo = state.sparks
            .flatMap(s => s.todos || [])
            .find(t => t.id === todo.id)
          
          const conflict = existingTodo ? 'existing' : 'none'
          
          const item: ImportItem = {
            id: `todo-${todo.id}`,
            type: 'todo',
            data: todo,
            selected: true,
            conflict,
            resolution: conflict === 'existing' ? 'skip' : 'duplicate'
          }
          
          items.push(item)
          allSelected.add(item.id)
        }
      }

      setImportedData(data)
      setImportItems(items)
      setSelectedItems(allSelected)
      setStep('preview')

    } catch (error) {
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Failed to parse JSON file.',
        variant: 'destructive'
      })
    } finally {
      setIsProcessing(false)
    }

    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleItemToggle = (itemId: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId)
    } else {
      newSelected.add(itemId)
    }
    setSelectedItems(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedItems.size === importItems.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(importItems.map(item => item.id)))
    }
  }

  const handleConflictResolution = (itemId: string, resolution: 'skip' | 'overwrite' | 'duplicate') => {
    setConflictResolutions(prev => ({
      ...prev,
      [itemId]: resolution
    }))
  }

  const handleNext = () => {
    const conflictItems = importItems.filter(item => 
      item.conflict === 'existing' && selectedItems.has(item.id)
    )
    
    if (conflictItems.length > 0 && step === 'preview') {
      setStep('conflicts')
    } else {
      handleImport()
    }
  }

  const handleImport = async () => {
    setStep('importing')
    setIsProcessing(true)

    try {
      const selectedSparks: Spark[] = []
      const selectedTodos: { sparkId: string; todo: Todo }[] = []

      for (const item of importItems) {
        if (!selectedItems.has(item.id)) continue

        const resolution = item.conflict === 'existing' 
          ? (conflictResolutions[item.id] || 'skip')
          : 'duplicate'

        if (resolution === 'skip') continue

        if (item.type === 'spark') {
          const spark = item.data as Spark
          let processedSpark = { ...spark }

          if (resolution === 'duplicate' || item.conflict === 'none') {
            // Generate new ID for duplicates or when no conflict
            processedSpark.id = crypto.randomUUID()
            processedSpark.createdAt = new Date()
            processedSpark.updatedAt = new Date()
          }

          // Remove todos from spark (they'll be processed separately)
          const { todos, ...sparkWithoutTodos } = processedSpark
          selectedSparks.push(sparkWithoutTodos as Spark)

          // Process todos belonging to this spark
          if (todos) {
            for (const todo of todos) {
              selectedTodos.push({
                sparkId: sparkWithoutTodos.id,
                todo: {
                  ...todo,
                  id: crypto.randomUUID(),
                  sparkId: sparkWithoutTodos.id,
                  createdAt: new Date()
                }
              })
            }
          }
        } else if (item.type === 'todo') {
          const todo = item.data as Todo
          let processedTodo = { ...todo }

          if (resolution === 'duplicate' || item.conflict === 'none') {
            processedTodo.id = crypto.randomUUID()
            processedTodo.createdAt = new Date()
          }

          selectedTodos.push({
            sparkId: todo.sparkId,
            todo: processedTodo
          })
        }
      }

      // Import sparks first
      for (const spark of selectedSparks) {
        if (conflictResolutions[`spark-${spark.id}`] === 'overwrite') {
          await actions.updateSpark(spark.id, spark)
        } else {
          await actions.createSpark({
            title: spark.title,
            description: spark.description,
            content: spark.content,
            status: spark.status,
            xp: spark.xp,
            level: spark.level,
            positionX: spark.positionX,
            positionY: spark.positionY,
            color: spark.color,
            tags: spark.tags
          })
        }
      }

      // Import todos
      for (const { sparkId, todo } of selectedTodos) {
        await actions.addTodo(sparkId, {
          title: todo.title,
          description: todo.description,
          type: todo.type,
          priority: todo.priority,
          completed: todo.completed
        })
      }

      toast({
        title: 'Import Successful',
        description: `Successfully imported ${selectedSparks.length} sparks and ${selectedTodos.length} todos.`
      })

      onOpenChange(false)
      resetState()

    } catch (error) {
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'An error occurred during import.',
        variant: 'destructive'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const resetState = () => {
    setStep('upload')
    setImportedData(null)
    setImportItems([])
    setSelectedItems(new Set())
    setConflictResolutions({})
    setIsProcessing(false)
  }

  const handleCancel = () => {
    onOpenChange(false)
    resetState()
  }

  const getStepTitle = () => {
    switch (step) {
      case 'upload': return 'Import Project Data'
      case 'preview': return 'Preview Import'
      case 'conflicts': return 'Resolve Conflicts'
      case 'importing': return 'Importing Data'
      default: return 'Import Project Data'
    }
  }

  const renderUploadStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Upload className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Import Project Data</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Select a JSON file to import sparks and todos into your project
        </p>
      </div>

      <Card className="border-dashed">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Choose a JSON file</p>
              <p className="text-xs text-muted-foreground">
                Exported project files (.json)
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isProcessing}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? 'Processing...' : 'Select File'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Import will merge data with your existing project. Conflicts will be resolved in the next step.
        </AlertDescription>
      </Alert>
    </div>
  )

  const renderPreviewStep = () => {
    const sparkItems = importItems.filter(item => item.type === 'spark')
    const todoItems = importItems.filter(item => item.type === 'todo')
    const conflictCount = importItems.filter(item => item.conflict === 'existing').length

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Import Preview</h3>
            <p className="text-sm text-muted-foreground">
              {importedData?.projectName && `Project: ${importedData.projectName}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">
              {selectedItems.size} of {importItems.length} selected
            </p>
            {conflictCount > 0 && (
              <p className="text-sm text-amber-600">
                {conflictCount} conflicts detected
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <Checkbox 
            checked={selectedItems.size === importItems.length}
            onCheckedChange={handleSelectAll}
          />
          <Label className="text-sm">Select all items</Label>
        </div>

        <ScrollArea className="h-96">
          <div className="space-y-4">
            {sparkItems.length > 0 && (
              <div>
                <h4 className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Lightbulb className="h-4 w-4" />
                  Sparks ({sparkItems.length})
                </h4>
                <div className="space-y-2">
                  {sparkItems.map(item => {
                    const spark = item.data as Spark
                    return (
                      <Card key={item.id} className="p-3">
                        <div className="flex items-start gap-3">
                          <Checkbox 
                            checked={selectedItems.has(item.id)}
                            onCheckedChange={() => handleItemToggle(item.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h5 className="font-medium truncate">{spark.title}</h5>
                              <Badge variant="outline" className="text-xs">
                                {spark.status}
                              </Badge>
                              {item.conflict === 'existing' && (
                                <Badge variant="destructive" className="text-xs">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Conflict
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {spark.description || 'No description'}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                XP: {spark.xp}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                Level: {spark.level}
                              </Badge>
                              {spark.todos && (
                                <Badge variant="secondary" className="text-xs">
                                  {spark.todos.length} todos
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )}

            {todoItems.length > 0 && (
              <div>
                <h4 className="flex items-center gap-2 text-sm font-medium mb-2">
                  <ListTodo className="h-4 w-4" />
                  Todos ({todoItems.length})
                </h4>
                <div className="space-y-2">
                  {todoItems.map(item => {
                    const todo = item.data as Todo
                    return (
                      <Card key={item.id} className="p-3">
                        <div className="flex items-start gap-3">
                          <Checkbox 
                            checked={selectedItems.has(item.id)}
                            onCheckedChange={() => handleItemToggle(item.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h5 className="font-medium truncate">{todo.title}</h5>
                              <Badge variant="outline" className="text-xs">
                                {todo.priority}
                              </Badge>
                              {item.conflict === 'existing' && (
                                <Badge variant="destructive" className="text-xs">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Conflict
                                </Badge>
                              )}
                              {todo.completed && (
                                <Badge variant="default" className="text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Completed
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {todo.description || 'No description'}
                            </p>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    )
  }

  const renderConflictsStep = () => {
    const conflictItems = importItems.filter(item => 
      item.conflict === 'existing' && selectedItems.has(item.id)
    )

    return (
      <div className="space-y-4">
        <div>
          <h3 className="font-medium">Resolve Conflicts</h3>
          <p className="text-sm text-muted-foreground">
            Choose how to handle items that already exist in your project
          </p>
        </div>

        <ScrollArea className="h-96">
          <div className="space-y-4">
            {conflictItems.map(item => {
              const data = item.data as Spark | Todo
              const currentResolution = conflictResolutions[item.id] || 'skip'
              
              return (
                <Card key={item.id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      {item.type === 'spark' ? (
                        <Lightbulb className="h-4 w-4 mt-1" />
                      ) : (
                        <ListTodo className="h-4 w-4 mt-1" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h5 className="font-medium">{data.title}</h5>
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Conflict
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {data.description || 'No description'}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Resolution:</Label>
                      <RadioGroup 
                        value={currentResolution}
                        onValueChange={(value: 'skip' | 'overwrite' | 'duplicate') => 
                          handleConflictResolution(item.id, value)
                        }
                      >
                        {Object.entries(CONFLICT_ACTIONS).map(([action, config]) => {
                          const Icon = config.icon
                          return (
                            <div key={action} className="flex items-center space-x-2">
                              <RadioGroupItem value={action} id={`${item.id}-${action}`} />
                              <Label 
                                htmlFor={`${item.id}-${action}`}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <Icon className="h-4 w-4" />
                                <div>
                                  <div className="text-sm font-medium">{config.label}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {config.description}
                                  </div>
                                </div>
                              </Label>
                            </div>
                          )
                        })}
                      </RadioGroup>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </ScrollArea>
      </div>
    )
  }

  const renderImportingStep = () => (
    <div className="text-center space-y-4 py-8">
      <div className="h-16 w-16 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <div>
        <h3 className="font-medium mb-2">Importing Data...</h3>
        <p className="text-sm text-muted-foreground">
          Please wait while we import your selected items
        </p>
      </div>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {getStepTitle()}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Import sparks and todos from a JSON export file'}
            {step === 'preview' && 'Review and select items to import'}
            {step === 'conflicts' && 'Resolve conflicts with existing data'}
            {step === 'importing' && 'Importing your selected data'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {step === 'upload' && renderUploadStep()}
          {step === 'preview' && renderPreviewStep()}
          {step === 'conflicts' && renderConflictsStep()}
          {step === 'importing' && renderImportingStep()}
        </div>

        {step !== 'importing' && (
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            {(step === 'preview' || step === 'conflicts') && (
              <Button 
                onClick={handleNext}
                disabled={selectedItems.size === 0 || isProcessing}
              >
                {step === 'preview' ? 'Continue' : 'Import Selected'}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}