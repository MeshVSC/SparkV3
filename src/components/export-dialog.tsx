"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { FileSpreadsheet, Download, Loader2 } from "lucide-react"
import Papa from "papaparse"
import { Spark, Todo } from "@/types/spark"
import { useToast } from "@/hooks/use-toast"

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sparks: Spark[]
}

interface FieldConfig {
  key: string
  label: string
  description?: string
  default?: boolean
}

const sparkFields: FieldConfig[] = [
  { key: "title", label: "Title", description: "Spark title", default: true },
  { key: "description", label: "Description", description: "Spark description", default: true },
  { key: "content", label: "Content", description: "Detailed content", default: false },
  { key: "status", label: "Status", description: "Current status", default: true },
  { key: "level", label: "Level", description: "Spark level", default: false },
  { key: "xp", label: "XP", description: "Experience points", default: false },
  { key: "color", label: "Color", description: "Display color", default: false },
  { key: "tags", label: "Tags", description: "Associated tags", default: true },
  { key: "positionX", label: "Position X", description: "Canvas X position", default: false },
  { key: "positionY", label: "Position Y", description: "Canvas Y position", default: false },
  { key: "createdAt", label: "Created Date", description: "Creation date", default: true },
  { key: "updatedAt", label: "Updated Date", description: "Last update date", default: false },
  { key: "todoCount", label: "Todo Count", description: "Number of todos", default: false },
  { key: "completedTodoCount", label: "Completed Todos", description: "Number of completed todos", default: false },
  { key: "attachmentCount", label: "Attachment Count", description: "Number of attachments", default: false },
]

const todoFields: FieldConfig[] = [
  { key: "sparkTitle", label: "Spark Title", description: "Parent spark title", default: true },
  { key: "title", label: "Todo Title", description: "Todo title", default: true },
  { key: "description", label: "Description", description: "Todo description", default: true },
  { key: "completed", label: "Completed", description: "Completion status", default: true },
  { key: "type", label: "Type", description: "Todo type", default: false },
  { key: "priority", label: "Priority", description: "Priority level", default: false },
  { key: "positionX", label: "Position X", description: "Canvas X position", default: false },
  { key: "positionY", label: "Position Y", description: "Canvas Y position", default: false },
  { key: "createdAt", label: "Created Date", description: "Creation date", default: true },
  { key: "completedAt", label: "Completed Date", description: "Completion date", default: false },
]

export function ExportDialog({ open, onOpenChange, sparks }: ExportDialogProps) {
  const [exportType, setExportType] = useState<"sparks" | "todos">("sparks")
  const [selectedSparkFields, setSelectedSparkFields] = useState<Array<string>>(
    sparkFields.filter(field => field.default).map(field => field.key)
  )
  const [selectedTodoFields, setSelectedTodoFields] = useState<Array<string>>(
    todoFields.filter(field => field.default).map(field => field.key)
  )
  const [isExporting, setIsExporting] = useState(false)
  const { toast } = useToast()

  const handleSparkFieldChange = (fieldKey: string, checked: boolean) => {
    setSelectedSparkFields(prev =>
      checked
        ? [...prev, fieldKey]
        : prev.filter(key => key !== fieldKey)
    )
  }

  const handleTodoFieldChange = (fieldKey: string, checked: boolean) => {
    setSelectedTodoFields(prev =>
      checked
        ? [...prev, fieldKey]
        : prev.filter(key => key !== fieldKey)
    )
  }

  const selectAllFields = (type: "sparks" | "todos") => {
    if (type === "sparks") {
      setSelectedSparkFields(sparkFields.map(field => field.key))
    } else {
      setSelectedTodoFields(todoFields.map(field => field.key))
    }
  }

  const selectDefaultFields = (type: "sparks" | "todos") => {
    if (type === "sparks") {
      setSelectedSparkFields(sparkFields.filter(field => field.default).map(field => field.key))
    } else {
      setSelectedTodoFields(todoFields.filter(field => field.default).map(field => field.key))
    }
  }

const serializeTags = (tags: unknown): string => {
  if (!tags) return "";
  try {
    if (typeof tags === "string") {
      try {
        const parsed = JSON.parse(tags);
        if (Array.isArray(parsed)) return parsed.join(", ");
        return tags;
      } catch {
        return tags;
      }
    }
    if (Array.isArray(tags)) return tags.join(", ");
    return String(tags);
  } catch {
    return "";
  }
};

  const processSparkData = (sparks: Spark[], fields: string[]) => {
    return sparks.map(spark => {
      const row: Record<string, any> = {}

      fields.forEach(field => {
        switch (field) {
          case "tags":
            row[field] = serializeTags(spark.tags)
            break
          case "todoCount":
            row[field] = spark.todos?.length || 0
            break
          case "completedTodoCount":
            row[field] = spark.todos?.filter(todo => todo.completed).length || 0
            break
          case "attachmentCount":
            row[field] = spark.attachments?.length || 0
            break
          case "createdAt":
          case "updatedAt":
            row[field] = spark[field] ? new Date(spark[field]).toLocaleDateString() : ""
            break
          default:
            row[field] = spark[field as keyof Spark] || ""
        }
      })

      return row
    })
  }

  const processTodoData = (sparks: Spark[], fields: string[]) => {
    const todos: any[] = []

    sparks.forEach(spark => {
      if (spark.todos) {
        spark.todos.forEach(todo => {
          const row: Record<string, any> = {}

          fields.forEach(field => {
            switch (field) {
              case "sparkTitle":
                row[field] = spark.title
                break
              case "completed":
                row[field] = todo.completed ? "Yes" : "No"
                break
              case "createdAt":
              case "completedAt":
                row[field] = todo[field] ? new Date(todo[field]).toLocaleDateString() : ""
                break
              default:
                row[field] = todo[field as keyof Todo] || ""
            }
          })

          todos.push(row)
        })
      }
    })

    return todos
  }

  const handleExport = async () => {
    try {
      setIsExporting(true)

      const selectedFields = exportType === "sparks" ? selectedSparkFields : selectedTodoFields

      if (selectedFields.length === 0) {
        toast({
          title: "No Fields Selected",
          description: "Please select at least one field to export.",
          variant: "destructive",
        })
        return
      }

      let csvData: any[]
      let filename: string
      const timestamp = new Date().toISOString().split('T')[0]

      if (exportType === "sparks") {
        csvData = processSparkData(sparks, selectedFields)
        filename = `sparks_export_${timestamp}.csv`
      } else {
        csvData = processTodoData(sparks, selectedFields)
        filename = `todos_export_${timestamp}.csv`
      }

      if (csvData.length === 0) {
        toast({
          title: "No Data to Export",
          description: `No ${exportType} found to export.`,
          variant: "destructive",
        })
        return
      }

      // Generate CSV using PapaParse
      const csv = Papa.unparse(csvData, {
        header: true,
        delimiter: ",",
        quotes: true,
        skipEmptyLines: true
      })

      // Create and download the file
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", filename)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: "Export Successful",
        description: `${exportType.charAt(0).toUpperCase() + exportType.slice(1)} data exported as ${filename}`,
      })

      onOpenChange(false)
    } catch (error) {
      console.error("CSV export error:", error)
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const currentFields = exportType === "sparks" ? sparkFields : todoFields
  const selectedFields = exportType === "sparks" ? selectedSparkFields : selectedTodoFields
  const totalData = exportType === "sparks"
    ? sparks.length
    : sparks.reduce((sum, spark) => sum + (spark.todos?.length || 0), 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Export to CSV
          </DialogTitle>
          <DialogDescription>
            Select the data type and fields you want to include in your CSV export.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={exportType} onValueChange={(value) => setExportType(value as "sparks" | "todos")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sparks" className="flex items-center gap-2">
              Sparks Data ({sparks.length})
            </TabsTrigger>
            <TabsTrigger value="todos" className="flex items-center gap-2">
              Todos Data ({sparks.reduce((sum, spark) => sum + (spark.todos?.length || 0), 0)})
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground">
                {selectedFields.length} of {currentFields.length} fields selected
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => selectDefaultFields(exportType)}
                >
                  Select Defaults
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => selectAllFields(exportType)}
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => exportType === "sparks"
                    ? setSelectedSparkFields([])
                    : setSelectedTodoFields([])
                  }
                >
                  Clear All
                </Button>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="max-h-[40vh] overflow-y-auto space-y-3">
              {currentFields.map((field) => {
                const isSelected = selectedFields.includes(field.key)
                const handleChange = exportType === "sparks"
                  ? handleSparkFieldChange
                  : handleTodoFieldChange

                return (
                  <div key={field.key} className="flex items-start space-x-3">
                    <Checkbox
                      id={field.key}
                      checked={isSelected}
                      onCheckedChange={(checked) => handleChange(field.key, checked === true)}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label
                        htmlFor={field.key}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {field.label}
                        {field.default && (
                          <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                            default
                          </span>
                        )}
                      </Label>
                      {field.description && (
                        <p className="text-xs text-muted-foreground">
                          {field.description}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Tabs>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleExport}
            disabled={isExporting || selectedFields.length === 0 || totalData === 0}
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export CSV ({totalData} records)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
