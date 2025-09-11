'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { RefreshCw, History, Undo2, User, Clock, FileText } from 'lucide-react'
import { ConnectionHistoryEntry } from '@/lib/connection-history-service'
import { toast } from 'sonner'

interface ConnectionHistoryViewerProps {
  connectionId?: string
  sparkIds?: string[]
  showRollback?: boolean
  className?: string
}

interface HistoryResponse {
  history: ConnectionHistoryEntry[]
  stats?: {
    totalChanges: number
    createdCount: number
    modifiedCount: number
    deletedCount: number
  }
  pagination?: {
    limit: number
    offset: number
    hasMore: boolean
  }
}

export function ConnectionHistoryViewer({
  connectionId,
  sparkIds,
  showRollback = true,
  className
}: ConnectionHistoryViewerProps) {
  const [history, setHistory] = useState<ConnectionHistoryEntry[]>([])
  const [stats, setStats] = useState<HistoryResponse['stats']>()
  const [loading, setLoading] = useState(true)
  const [rollbackLoading, setRollbackLoading] = useState<string | null>(null)

  const loadHistory = async () => {
    try {
      setLoading(true)
      
      let url = '/api/connections/history'
      const params = new URLSearchParams()
      
      if (connectionId) {
        url = `/api/connections/${connectionId}/history`
      } else if (sparkIds && sparkIds.length > 0) {
        params.append('sparkIds', sparkIds.join(','))
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`
      }

      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to load history')
      
      const data: HistoryResponse = await response.json()
      setHistory(data.history)
      setStats(data.stats)
    } catch (error) {
      console.error('Error loading connection history:', error)
      toast.error('Failed to load connection history')
    } finally {
      setLoading(false)
    }
  }

  const handleRollback = async (historyId: string, changeType: string) => {
    if (!confirm(`Are you sure you want to rollback this ${changeType.toLowerCase()} operation? This action cannot be undone.`)) {
      return
    }

    try {
      setRollbackLoading(historyId)
      
      const response = await fetch('/api/connections/history/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          historyId,
          reason: `Manual rollback of ${changeType.toLowerCase()} operation`
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Rollback failed')
      }

      toast.success('Successfully rolled back connection change')
      await loadHistory() // Refresh history
    } catch (error) {
      console.error('Error rolling back:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to rollback change')
    } finally {
      setRollbackLoading(null)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [connectionId, sparkIds])

  const getChangeTypeColor = (changeType: string) => {
    switch (changeType) {
      case 'CREATED': return 'bg-green-500/10 text-green-700 border-green-500/20'
      case 'MODIFIED': return 'bg-blue-500/10 text-blue-700 border-blue-500/20'
      case 'DELETED': return 'bg-red-500/10 text-red-700 border-red-500/20'
      default: return 'bg-gray-500/10 text-gray-700 border-gray-500/20'
    }
  }

  const getChangeTypeIcon = (changeType: string) => {
    switch (changeType) {
      case 'CREATED': return '+'
      case 'MODIFIED': return '~'
      case 'DELETED': return '-'
      default: return '?'
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Connection History
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={loadHistory}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        
        {stats && (
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>Total: {stats.totalChanges}</span>
            <span className="text-green-600">Created: {stats.createdCount}</span>
            <span className="text-blue-600">Modified: {stats.modifiedCount}</span>
            <span className="text-red-600">Deleted: {stats.deletedCount}</span>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading history...</span>
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mb-2 opacity-50" />
            <p>No connection history found</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {history.map((entry, index) => (
                <div key={entry.id} className="relative">
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`
                        flex items-center justify-center w-8 h-8 rounded-full border-2 font-mono text-sm font-bold
                        ${getChangeTypeColor(entry.changeType)}
                      `}>
                        {getChangeTypeIcon(entry.changeType)}
                      </div>
                      {index < history.length - 1 && (
                        <div className="w-0.5 h-6 bg-border mt-2" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className={getChangeTypeColor(entry.changeType)}>
                          {entry.changeType}
                        </Badge>
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {entry.username}
                        </span>
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(entry.createdAt), 'MMM d, yyyy HH:mm')}
                        </span>
                      </div>

                      <div className="text-sm">
                        <p className="mb-2">
                          Connection between <strong>{entry.sparkId1}</strong> and <strong>{entry.sparkId2}</strong>
                        </p>
                        
                        {entry.reason && (
                          <p className="text-muted-foreground flex items-start gap-1">
                            <FileText className="h-3 w-3 mt-0.5" />
                            {entry.reason}
                          </p>
                        )}
                      </div>

                      {showRollback && entry.changeType !== 'MODIFIED' && (
                        <div className="mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRollback(entry.id, entry.changeType)}
                            disabled={rollbackLoading === entry.id}
                          >
                            <Undo2 className={`h-3 w-3 mr-1 ${rollbackLoading === entry.id ? 'animate-spin' : ''}`} />
                            Rollback
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {index < history.length - 1 && (
                    <Separator className="mt-4" />
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}