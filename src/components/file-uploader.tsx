"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { 
  Upload, 
  File, 
  Image as ImageIcon, 
  X, 
  Download,
  FileText,
  Video
} from "lucide-react"
import { Attachment } from "@/types/spark"
import { useSpark } from "@/contexts/spark-context"

interface FileUploaderProps {
  sparkId: string
  attachments: Attachment[]
  onAttachmentChange?: (attachments: Attachment[]) => void
}

export function FileUploader({ sparkId, attachments, onAttachmentChange }: FileUploaderProps) {
  const { actions } = useSpark()
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 100)

      await actions.uploadAttachment(sparkId, file)
      
      clearInterval(progressInterval)
      setUploadProgress(100)
      
      // Reset progress after a delay
      setTimeout(() => {
        setUploadProgress(0)
        setIsUploading(false)
      }, 1000)
    } catch (error) {
      console.error("Error uploading file:", error)
      setIsUploading(false)
      setUploadProgress(0)
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    await actions.deleteAttachment(sparkId, attachmentId)
  }

  const getFileIcon = (type: string, filename: string) => {
    if (type === "IMAGE") {
      return <ImageIcon className="h-8 w-8 text-blue-500" />
    }
    
    const extension = filename.split('.').pop()?.toLowerCase()
    if (["mp4", "mov", "avi", "mkv"].includes(extension || "")) {
      return <Video className="h-8 w-8 text-purple-500" />
    }
    
    if (["pdf", "doc", "docx", "txt"].includes(extension || "")) {
      return <FileText className="h-8 w-8 text-green-500" />
    }
    
    return <File className="h-8 w-8 text-gray-500" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="text-center">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <h3 className="text-lg font-medium mb-1">Upload Files</h3>
              <p className="text-sm text-muted-foreground">
                Drag and drop files here or click to browse
              </p>
            </div>

            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            <div className="flex justify-center">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.txt,.mp4,.mov,.avi,.mkv"
                disabled={isUploading}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                variant="outline"
              >
                <Upload className="h-4 w-4 mr-2" />
                Choose File
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Attachments ({attachments.length})</h4>
          <div className="grid grid-cols-1 gap-2">
            {attachments.map((attachment) => (
              <Card key={attachment.id} className="p-3">
                <div className="flex items-center gap-3">
                  {getFileIcon(attachment.type, attachment.filename)}
                  
                  <div className="flex-1 min-w-0">
                    <h5 className="text-sm font-medium truncate">
                      {attachment.filename}
                    </h5>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {attachment.type}
                      </Badge>
                      {attachment.size && (
                        <span>{formatFileSize(attachment.size)}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(attachment.url, "_blank")}
                      className="h-8 w-8 p-0"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAttachment(attachment.id)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}