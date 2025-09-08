'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Download, FileText, Image, Database, FileSpreadsheet } from 'lucide-react'
import { ExportService } from '@/utils/services/ExportService'
import { downloadJson, downloadPdf } from '@/utils/file-downloader'
import { useToast } from '@/hooks/use-toast'

interface ExportDropdownProps {
  projectName?: string
  sparks?: any[]
  connections?: any[]
  onExport?: (type: 'json' | 'pdf') => void
}

interface ExportOptions {
  projectName: string
  includeAttachments: boolean
  includeVisualizations: boolean
}

export function ExportDropdown({
  projectName = "Spark Project",
  sparks = [],
  connections = [],
  onExport
}: ExportDropdownProps) {
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [exportType, setExportType] = useState<'json' | 'pdf'>('json')
  const [isExporting, setIsExporting] = useState(false)
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    projectName: projectName,
    includeAttachments: true,
    includeVisualizations: true
  })
  const { toast } = useToast()

  const handleExportClick = (type: 'json' | 'pdf') => {
    setExportType(type)
    setExportOptions(prev => ({ ...prev, projectName }))
    setIsExportDialogOpen(true)
  }

  const handleQuickJSONExport = async () => {
    try {
      setIsExporting(true)
      
      // Call the API endpoint directly for quick export
      const response = await fetch('/api/export/json', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || 'Export failed')
      }

      // Get the JSON data
      const jsonData = await response.json()
      
      // Create filename
      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_export_${timestamp}.json`
      
      // Download the file
      const result = downloadJson(jsonData, { filename })
      
      if (result.success) {
        toast({
          title: 'Export Successful',
          description: `Project exported as ${filename}`,
        })
        onExport?.('json')
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Quick JSON export error:', error)
      toast({
        title: 'Export Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleCSVExportClick = async (type: 'sparks' | 'todos' | 'stats') => {
    try {
      setIsExporting(true)
      
      let csvContent = ''
      let filename = ''
      const timestamp = new Date().toISOString().split('T')[0]
      const projectSlug = projectName.replace(/[^a-zA-Z0-9]/g, '_')
      
      switch (type) {
        case 'sparks':
          csvContent = await ExportService.exportSparksToCSV(sparks)
          filename = `${projectSlug}_sparks_${timestamp}.csv`
          break
        case 'todos':
          csvContent = await ExportService.exportTodosToCSV(sparks)
          filename = `${projectSlug}_todos_${timestamp}.csv`
          break
        case 'stats':
          csvContent = await ExportService.exportProjectStatsToCSV({ 
            sparks, 
            connections, 
            projectName 
          })
          filename = `${projectSlug}_statistics_${timestamp}.csv`
          break
      }
      
      // Create and download the CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      toast({
        title: 'CSV Export Successful',
        description: `${type.charAt(0).toUpperCase() + type.slice(1)} data exported as ${filename}`,
      })
      
    } catch (error) {
      console.error('CSV export error:', error)
      toast({
        title: 'CSV Export Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleConfirmExport = async () => {
    try {
      setIsExporting(true)

      if (exportType === 'json') {
        // Call API with custom options
        const response = await fetch('/api/export/json', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectName: exportOptions.projectName,
            includeAttachments: exportOptions.includeAttachments,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.details || 'Export failed')
        }

        const result = await response.json()
        
        if (result.success) {
          const downloadResult = downloadJson(result.data, { filename: result.filename })
          
          if (downloadResult.success) {
            toast({
              title: 'JSON Export Successful',
              description: `Project exported as ${result.filename}`,
            })
            onExport?.('json')
          } else {
            throw new Error(downloadResult.error)
          }
        } else {
          throw new Error('Export API returned unsuccessful response')
        }
        
      } else if (exportType === 'pdf') {
        // Use existing PDF export functionality
        const projectData = {
          sparks,
          connections,
          projectName: exportOptions.projectName,
          statistics: {
            totalSparks: sparks.length,
            totalConnections: connections.length,
          }
        }

        const pdfBlob = await ExportService.exportProjectToPDF(projectData)
        const timestamp = new Date().toISOString().split('T')[0]
        const filename = `${exportOptions.projectName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.pdf`
        
        const result = downloadPdf(pdfBlob, filename)
        
        if (result.success) {
          toast({
            title: 'PDF Export Successful',
            description: `Project exported as ${filename}`,
          })
          onExport?.('pdf')
        } else {
          throw new Error(result.error)
        }
      }

    } catch (error) {
      console.error('Export error:', error)
      toast({
        title: 'Export Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
      setIsExportDialogOpen(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Export Options</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={handleQuickJSONExport} disabled={isExporting}>
            <Database className="h-4 w-4 mr-2" />
            Quick JSON Export
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => handleExportClick('json')} disabled={isExporting}>
            <Database className="h-4 w-4 mr-2" />
            JSON (Custom)
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => handleExportClick('pdf')} disabled={isExporting}>
            <FileText className="h-4 w-4 mr-2" />
            PDF Document
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={() => handleCSVExportClick('sparks')} disabled={isExporting}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            CSV - Sparks Data
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => handleCSVExportClick('todos')} disabled={isExporting}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            CSV - Tasks Data
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => handleCSVExportClick('stats')} disabled={isExporting}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            CSV - Project Stats
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem disabled>
            <Image className="h-4 w-4 mr-2" />
            PNG Image (Coming Soon)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              Export as {exportType === 'json' ? 'JSON' : 'PDF'}
            </DialogTitle>
            <DialogDescription>
              Customize your export options before downloading your project.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="project-name" className="text-right">
                Project Name
              </Label>
              <Input
                id="project-name"
                value={exportOptions.projectName}
                onChange={(e) =>
                  setExportOptions(prev => ({ ...prev, projectName: e.target.value }))
                }
                className="col-span-3"
                placeholder="Enter project name"
              />
            </div>
            
            {exportType === 'json' && (
              <>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-attachments"
                    checked={exportOptions.includeAttachments}
                    onCheckedChange={(checked) =>
                      setExportOptions(prev => ({ 
                        ...prev, 
                        includeAttachments: checked === true 
                      }))
                    }
                  />
                  <Label htmlFor="include-attachments" className="text-sm">
                    Include attachment metadata
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-visualizations"
                    checked={exportOptions.includeVisualizations}
                    onCheckedChange={(checked) =>
                      setExportOptions(prev => ({ 
                        ...prev, 
                        includeVisualizations: checked === true 
                      }))
                    }
                  />
                  <Label htmlFor="include-visualizations" className="text-sm">
                    Include visualization data
                  </Label>
                </div>
              </>
            )}
            
            {exportType === 'pdf' && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-visualizations-pdf"
                  checked={exportOptions.includeVisualizations}
                  onCheckedChange={(checked) =>
                    setExportOptions(prev => ({ 
                      ...prev, 
                      includeVisualizations: checked === true 
                    }))
                  }
                />
                <Label htmlFor="include-visualizations-pdf" className="text-sm">
                  Include canvas visualizations
                </Label>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsExportDialogOpen(false)}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmExport}
              disabled={isExporting || !exportOptions.projectName.trim()}
            >
              {isExporting ? 'Exporting...' : `Export ${exportType.toUpperCase()}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}