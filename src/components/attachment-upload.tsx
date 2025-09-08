"use client"

import { useState, useRef } from "react"
import { useSpark } from "@/contexts/spark-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Attachment, AttachmentType } from "@/types/spark"
import { 
  Paperclip, 
  Image, 
  File, 
  Link, 
  Download, 
  Trash2, 
  Plus,
  Upload,
  ExternalLink,
  MessageSquare
} from "lucide-react"
import { CommentSection } from "@/components/ui/comment-section"

interface AttachmentUploadProps {
  sparkId: string
  attachments: Attachment[]
  onAttachmentAdd: (attachment: Attachment) => void
  onAttachmentDelete: (attachmentId: string) => void
}

export function AttachmentUpload({ 
  sparkId, 
  attachments, 
  onAttachmentAdd, 
  onAttachmentDelete 
}: AttachmentUploadProps) {
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [uploadType, setUploadType] = useState<"file" | "link">("file")
  const [fileType, setFileType] = useState<AttachmentType>(AttachmentType.FILE)
  const [url, setUrl] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [showCommentsFor, setShowCommentsFor] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (file: File) => {
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", fileType)

      const response = await fetch(`/api/sparks/${sparkId}/attachments`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Failed to upload file")
      }

      const attachment = await response.json()
      onAttachmentAdd(attachment)
      setIsUploadDialogOpen(false)
      setFileType(AttachmentType.FILE)
    } catch (error) {
      console.error("Error uploading file:", error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleUrlUpload = async () => {
    if (!url.trim()) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("url", url.trim())

      const response = await fetch(`/api/sparks/${sparkId}/attachments`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Failed to add link")
      }

      const attachment = await response.json()
      onAttachmentAdd(attachment)
      setIsUploadDialogOpen(false)
      setUrl("")
    } catch (error) {
      console.error("Error adding link:", error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  const handleDelete = async (attachmentId: string) => {
    try {
      await fetch(`/api/attachments/${attachmentId}`, {
        method: "DELETE",
      })
      onAttachmentDelete(attachmentId)
    } catch (error) {
      console.error("Error deleting attachment:", error)
    }
  }

  const getAttachmentIcon = (type: AttachmentType, filename: string) => {
    switch (type) {
      case AttachmentType.IMAGE:
        return <Image className="h-4 w-4" alt="Image icon" />
      case AttachmentType.LINK:
        return <Link className="h-4 w-4" alt="Link icon" />
      default:
        return <File className="h-4 w-4" alt="File icon" />
    }
  }

  const getFileSize = (size: number) => {
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Attachments</h3>
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Attachment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Attachment</DialogTitle>
              <DialogDescription>
                Add a file or link to your spark to enhance it with additional resources and references.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={uploadType === "file" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUploadType("file")}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  File
                </Button>
                <Button
                  variant={uploadType === "link" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUploadType("link")}
                >
                  <Link className="h-4 w-4 mr-2" />
                  Link
                </Button>
              </div>

              {uploadType === "file" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="file-type">Type</Label>
                    <Select value={fileType} onValueChange={(value) => setFileType(value as AttachmentType)}>
                      <SelectTrigger id="file-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={AttachmentType.FILE}>File</SelectItem>
                        <SelectItem value={AttachmentType.IMAGE}>Image</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="file">File</Label>
                    <Input
                      id="file"
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      accept={fileType === AttachmentType.IMAGE ? "image/*" : "*/*"}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="url">URL</Label>
                    <Input
                      id="url"
                      placeholder="https://example.com"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                  </div>
                  
                  <Button 
                    onClick={handleUrlUpload} 
                    disabled={!url.trim() || isUploading}
                    className="w-full"
                  >
                    {isUploading ? "Adding..." : "Add Link"}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {attachments.map((attachment) => (
          <Card key={attachment.id} className="p-3">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                {getAttachmentIcon(attachment.type, attachment.filename)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-medium truncate">
                    {attachment.filename}
                  </h4>
                  <Badge variant="outline" className="text-xs">
                    {attachment.type.toLowerCase()}
                  </Badge>
                </div>
                
                {attachment.size && (
                  <p className="text-xs text-muted-foreground">
                    {getFileSize(attachment.size)}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCommentsFor(showCommentsFor === attachment.id ? null : attachment.id)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <MessageSquare className="h-3 w-3" />
                </Button>
                
                {attachment.type !== AttachmentType.LINK && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(attachment.url, "_blank")}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                )}
                
                {attachment.type === AttachmentType.LINK && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(attachment.url, "_blank")}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(attachment.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            {showCommentsFor === attachment.id && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <CommentSection
                  entityId={attachment.id}
                  entityType="ATTACHMENT"
                  className="text-sm"
                />
              </div>
            )}
          </Card>
        ))}
      </div>

      {attachments.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No attachments yet. Add one to get started!</p>
        </div>
      )}
    </div>
  )
}