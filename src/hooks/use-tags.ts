'use client'

import { useState, useEffect } from 'react'
import { Tag, TagStats, CreateTagData, UpdateTagData } from '@/types/tag'
import { useToast } from '@/hooks/use-toast'

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([])
  const [stats, setStats] = useState<TagStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchTags = async (includeChildren = true) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/tags?includeChildren=${includeChildren}`)
      if (!response.ok) {
        throw new Error('Failed to fetch tags')
      }
      const data = await response.json()
      setTags(data.tags)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      toast({
        title: 'Error',
        description: 'Failed to fetch tags',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/tags/stats')
      if (!response.ok) {
        throw new Error('Failed to fetch stats')
      }
      const data = await response.json()
      setStats(data.stats)
    } catch (err) {
      console.error('Failed to fetch tag stats:', err)
    }
  }

  const createTag = async (data: CreateTagData): Promise<Tag | null> => {
    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create tag')
      }

      const result = await response.json()
      setTags(prev => [...prev, result.tag])
      toast({
        title: 'Success',
        description: 'Tag created successfully',
      })
      return result.tag
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
      return null
    }
  }

  const updateTag = async (id: string, data: UpdateTagData): Promise<Tag | null> => {
    try {
      const response = await fetch(`/api/tags/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update tag')
      }

      const result = await response.json()
      setTags(prev => prev.map(tag => tag.id === id ? result.tag : tag))
      toast({
        title: 'Success',
        description: 'Tag updated successfully',
      })
      return result.tag
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
      return null
    }
  }

  const deleteTag = async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/tags/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete tag')
      }

      setTags(prev => prev.filter(tag => tag.id !== id))
      toast({
        title: 'Success',
        description: 'Tag deleted successfully',
      })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
      return false
    }
  }

  useEffect(() => {
    fetchTags()
    fetchStats()
  }, [])

  return {
    tags,
    stats,
    loading,
    error,
    fetchTags,
    fetchStats,
    createTag,
    updateTag,
    deleteTag,
  }
}