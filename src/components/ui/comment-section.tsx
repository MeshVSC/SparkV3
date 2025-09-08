"use client"

import { useState, useEffect } from "react"
import { useSocket } from "@/hooks/use-socket"
import { CommentThread } from "./comment-thread"
import { Button } from "./button"
import { Textarea } from "./textarea"
import { Card, CardContent, CardHeader, CardTitle } from "./card"
import { MessageSquare, Send } from "lucide-react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"

export interface Comment {
  id: string
  content: string
  authorId: string
  author: {
    id: string
    name: string | null
    avatar: string | null
  }
  parentId: string | null
  entityId: string
  entityType: "SPARK" | "TODO" | "ATTACHMENT"
  editedAt: Date | null
  createdAt: Date
  updatedAt: Date
  replies?: Comment[]
  mentions: Array<{
    id: string
    userId: string
    user: {
      id: string
      name: string | null
    }
  }>
}

interface CommentSectionProps {
  entityId: string
  entityType: "SPARK" | "TODO" | "ATTACHMENT"
  className?: string
}

export function CommentSection({ entityId, entityType, className }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const { data: session } = useSession()
  const socket = useSocket()

  // Load comments
  useEffect(() => {
    const loadComments = async () => {
      try {
        const response = await fetch(`/api/comments?entityId=${entityId}&entityType=${entityType}`)
        if (response.ok) {
          const data = await response.json()
          setComments(data)
        }
      } catch (error) {
        console.error("Failed to load comments:", error)
        toast.error("Failed to load comments")
      } finally {
        setIsLoading(false)
      }
    }

    loadComments()
  }, [entityId, entityType])

  // Socket event handlers
  useEffect(() => {
    if (!socket) return

    const handleNewComment = (comment: Comment) => {
      if (comment.entityId === entityId && comment.entityType === entityType) {
        if (comment.parentId) {
          // It's a reply - add to parent's replies
          setComments(prev => addReplyToComments(prev, comment))
        } else {
          // It's a top-level comment
          setComments(prev => [comment, ...prev])
        }
      }
    }

    const handleCommentUpdated = (comment: Comment) => {
      if (comment.entityId === entityId && comment.entityType === entityType) {
        setComments(prev => updateCommentInTree(prev, comment))
      }
    }

    const handleCommentDeleted = (commentId: string) => {
      setComments(prev => removeCommentFromTree(prev, commentId))
    }

    socket.on("comment:new", handleNewComment)
    socket.on("comment:updated", handleCommentUpdated)
    socket.on("comment:deleted", handleCommentDeleted)

    return () => {
      socket.off("comment:new", handleNewComment)
      socket.off("comment:updated", handleCommentUpdated)
      socket.off("comment:deleted", handleCommentDeleted)
    }
  }, [socket, entityId, entityType])

  const addReplyToComments = (comments: Comment[], reply: Comment): Comment[] => {
    return comments.map(comment => {
      if (comment.id === reply.parentId) {
        return {
          ...comment,
          replies: [reply, ...(comment.replies || [])]
        }
      }
      if (comment.replies) {
        return {
          ...comment,
          replies: addReplyToComments(comment.replies, reply)
        }
      }
      return comment
    })
  }

  const updateCommentInTree = (comments: Comment[], updatedComment: Comment): Comment[] => {
    return comments.map(comment => {
      if (comment.id === updatedComment.id) {
        return updatedComment
      }
      if (comment.replies) {
        return {
          ...comment,
          replies: updateCommentInTree(comment.replies, updatedComment)
        }
      }
      return comment
    })
  }

  const removeCommentFromTree = (comments: Comment[], commentId: string): Comment[] => {
    return comments
      .filter(comment => comment.id !== commentId)
      .map(comment => ({
        ...comment,
        replies: comment.replies ? removeCommentFromTree(comment.replies, commentId) : []
      }))
  }

  const handleSubmit = async () => {
    if (!newComment.trim() || !session?.user?.id || isSubmitting) return

    setIsSubmitting(true)
    
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: newComment.trim(),
          entityId,
          entityType,
        }),
      })

      if (response.ok) {
        setNewComment("")
        toast.success("Comment added successfully")
      } else {
        throw new Error("Failed to create comment")
      }
    } catch (error) {
      console.error("Failed to create comment:", error)
      toast.error("Failed to create comment")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  if (isLoading) {
    return (
      <div className={className}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!session?.user?.id) {
    return (
      <div className={className}>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Sign in to view and add comments</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comments ({comments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* New Comment Form */}
          <div className="space-y-3">
            <Textarea
              placeholder="Write a comment... Use @ to mention users. Press Ctrl+Enter to submit."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-20 resize-none"
            />
            <div className="flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={!newComment.trim() || isSubmitting}
                size="sm"
              >
                <Send className="h-4 w-4 mr-2" />
                {isSubmitting ? "Posting..." : "Post Comment"}
              </Button>
            </div>
          </div>

          {/* Comments List */}
          <div className="space-y-4">
            {comments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No comments yet. Be the first to comment!</p>
              </div>
            ) : (
              comments.map((comment) => (
                <CommentThread
                  key={comment.id}
                  comment={comment}
                  entityId={entityId}
                  entityType={entityType}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}