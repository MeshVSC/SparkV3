"use client"

import { useState, useRef, useEffect } from "react"
import { Comment } from "./comment-section"
import { Button } from "./button"
import { Textarea } from "./textarea"
import { Avatar, AvatarFallback, AvatarImage } from "./avatar"
import { Card, CardContent } from "./card"
import { Badge } from "./badge"
import { 
  MessageSquare, 
  Reply, 
  Edit, 
  Trash2, 
  Send, 
  MoreVertical,
  Check,
  X
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu"
import { useSession } from "next-auth/react"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import { MentionDropdown } from "./mention-dropdown"

interface CommentThreadProps {
  comment: Comment
  entityId: string
  entityType: "SPARK" | "TODO" | "ATTACHMENT"
  depth?: number
}

export function CommentThread({ comment, entityId, entityType, depth = 0 }: CommentThreadProps) {
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [replyContent, setReplyContent] = useState("")
  const [editContent, setEditContent] = useState(comment.content)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState("")
  const [mentionStart, setMentionStart] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)
  const { data: session } = useSession()

  const isAuthor = session?.user?.id === comment.authorId
  const maxDepth = 3 // Maximum nesting depth

  useEffect(() => {
    if (isEditing) {
      setEditContent(comment.content)
    }
  }, [isEditing, comment.content])

  const handleMentionDetection = (value: string, cursorPos: number, textareaRef: React.RefObject<HTMLTextAreaElement>) => {
    const beforeCursor = value.slice(0, cursorPos)
    const atIndex = beforeCursor.lastIndexOf("@")
    
    if (atIndex >= 0) {
      const afterAt = beforeCursor.slice(atIndex + 1)
      if (!afterAt.includes(" ") && !afterAt.includes("\n")) {
        setMentionQuery(afterAt)
        setMentionStart(atIndex)
        setShowMentions(true)
        return
      }
    }
    
    setShowMentions(false)
  }

  const handleReplyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const cursorPos = e.target.selectionStart
    setReplyContent(value)
    handleMentionDetection(value, cursorPos, textareaRef)
  }

  const handleEditChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const cursorPos = e.target.selectionStart
    setEditContent(value)
    handleMentionDetection(value, cursorPos, editTextareaRef)
  }

  const handleMentionSelect = (user: { id: string; name: string | null }) => {
    const currentRef = isEditing ? editTextareaRef : textareaRef
    const currentContent = isEditing ? editContent : replyContent
    const currentSetter = isEditing ? setEditContent : setReplyContent
    
    const beforeMention = currentContent.slice(0, mentionStart)
    const afterMention = currentContent.slice(mentionStart + mentionQuery.length + 1)
    const newContent = `${beforeMention}@${user.name || user.id}${afterMention}`
    
    currentSetter(newContent)
    setShowMentions(false)
    
    // Focus back to textarea
    setTimeout(() => {
      if (currentRef.current) {
        const newCursorPos = mentionStart + (user.name || user.id).length + 1
        currentRef.current.focus()
        currentRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 0)
  }

  const handleReply = async () => {
    if (!replyContent.trim() || isSubmitting) return

    setIsSubmitting(true)
    
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: replyContent.trim(),
          entityId,
          entityType,
          parentId: comment.id,
        }),
      })

      if (response.ok) {
        setReplyContent("")
        setShowReplyForm(false)
        toast.success("Reply added successfully")
      } else {
        throw new Error("Failed to create reply")
      }
    } catch (error) {
      console.error("Failed to create reply:", error)
      toast.error("Failed to create reply")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = async () => {
    if (!editContent.trim() || isSubmitting) return

    setIsSubmitting(true)
    
    try {
      const response = await fetch(`/api/comments/${comment.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: editContent.trim(),
        }),
      })

      if (response.ok) {
        setIsEditing(false)
        toast.success("Comment updated successfully")
      } else {
        throw new Error("Failed to update comment")
      }
    } catch (error) {
      console.error("Failed to update comment:", error)
      toast.error("Failed to update comment")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (isSubmitting) return

    setIsSubmitting(true)
    
    try {
      const response = await fetch(`/api/comments/${comment.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast.success("Comment deleted successfully")
      } else {
        throw new Error("Failed to delete comment")
      }
    } catch (error) {
      console.error("Failed to delete comment:", error)
      toast.error("Failed to delete comment")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault()
      if (isEditing) {
        handleEdit()
      } else {
        handleReply()
      }
    }
  }

  const renderContent = (content: string) => {
    // Simple mention rendering - in a real app, you'd want more sophisticated parsing
    return content.replace(/@(\w+)/g, (match, username) => {
      return `<span class="text-blue-600 bg-blue-50 px-1 rounded font-medium">${match}</span>`
    })
  }

  return (
    <div className={`space-y-3 ${depth > 0 ? "ml-6 pl-4 border-l-2 border-gray-100" : ""}`}>
      <Card className="relative">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={comment.author.avatar || undefined} />
              <AvatarFallback>
                {comment.author.name?.charAt(0).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium text-sm">
                  {comment.author.name || "Anonymous User"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                </span>
                {comment.editedAt && (
                  <Badge variant="outline" className="text-xs">
                    edited
                  </Badge>
                )}
              </div>
              
              {isEditing ? (
                <div className="space-y-3 relative">
                  <Textarea
                    ref={editTextareaRef}
                    value={editContent}
                    onChange={handleEditChange}
                    onKeyDown={handleKeyDown}
                    className="min-h-20 text-sm"
                    placeholder="Edit your comment..."
                  />
                  {showMentions && (
                    <MentionDropdown
                      query={mentionQuery}
                      onSelect={handleMentionSelect}
                      className="absolute top-full left-0 z-50 mt-1"
                    />
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleEdit}
                      disabled={!editContent.trim() || isSubmitting}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false)
                        setEditContent(comment.content)
                      }}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className="text-sm text-gray-700 whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: renderContent(comment.content) }}
                />
              )}

              <div className="flex items-center gap-2 mt-3">
                {depth < maxDepth && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowReplyForm(!showReplyForm)}
                    className="h-8 px-2 text-xs"
                  >
                    <Reply className="h-3 w-3 mr-1" />
                    Reply
                  </Button>
                )}
                
                {comment.replies && comment.replies.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {comment.replies.length} {comment.replies.length === 1 ? "reply" : "replies"}
                  </span>
                )}
              </div>
            </div>

            {/* Actions Menu */}
            {(isAuthor || session?.user?.id) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isAuthor && (
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {isAuthor && (
                    <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reply Form */}
      {showReplyForm && (
        <div className="ml-11 space-y-3 relative">
          <Textarea
            ref={textareaRef}
            placeholder="Write a reply... Use @ to mention users. Press Ctrl+Enter to submit."
            value={replyContent}
            onChange={handleReplyChange}
            onKeyDown={handleKeyDown}
            className="min-h-20 text-sm"
          />
          {showMentions && (
            <MentionDropdown
              query={mentionQuery}
              onSelect={handleMentionSelect}
              className="absolute top-full left-0 z-50 mt-1"
            />
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleReply}
              disabled={!replyContent.trim() || isSubmitting}
            >
              <Send className="h-4 w-4 mr-1" />
              {isSubmitting ? "Posting..." : "Reply"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowReplyForm(false)
                setReplyContent("")
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-3">
          {comment.replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              entityId={entityId}
              entityType={entityType}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}