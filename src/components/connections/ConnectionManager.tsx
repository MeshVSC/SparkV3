'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Link2, Edit3, Trash2, Eye, History, RefreshCw } from 'lucide-react'
import { ConnectionHistoryViewer } from './ConnectionHistoryViewer'
import { ConnectionType } from '@/types/spark'
import { toast } from 'sonner'

interface Connection {
  id: string
  sparkId1: string
  sparkId2: string
  type: ConnectionType
  metadata: any
  createdAt: string
  spark1?: {
    id: string
    title: string
    color: string
    status: string
  }
  spark2?: {
    id: string
    title: string
    color: string
    status: string
  }
}

interface ConnectionManagerProps {
  sparkId?: string
  className?: string
}

const CONNECTION_TYPES = [
  { value: ConnectionType.RELATED_TO, label: 'Related To', description: 'General relationship' },
  { value: ConnectionType.DEPENDS_ON, label: 'Depends On', description: 'One depends on the other' },
  { value: ConnectionType.INSPIRES, label: 'Inspires', description: 'One inspires the other' },
  { value: ConnectionType.CONFLICTS_WITH, label: 'Conflicts With', description: 'Conflicting ideas' }
]

export function ConnectionManager({ sparkId, className }: ConnectionManagerProps) {
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null)
  
  // Edit form state
  const [editType, setEditType] = useState<ConnectionType>(ConnectionType.RELATED_TO)
  const [editReason, setEditReason] = useState('')

  const loadConnections = async () => {
    try {
      setLoading(true)
      const url = sparkId 
        ? `/api/connections?sparkId=${sparkId}`
        : '/api/connections'
      
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to load connections')
      
      const data = await response.json()
      setConnections(data.connections || [])
    } catch (error) {
      console.error('Error loading connections:', error)
      toast.error('Failed to load connections')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteConnection = async (connectionId: string) => {
    if (!confirm('Are you sure you want to delete this connection?')) {
      return
    }

    try {
      const response = await fetch(`/api/connections/${connectionId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete connection')
      }

      toast.success('Connection deleted successfully')
      await loadConnections()
    } catch (error) {
      console.error('Error deleting connection:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete connection')
    }
  }

  const handleEditConnection = async () => {
    if (!editingConnection) return

    try {
      const response = await fetch(`/api/connections/${editingConnection.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: editType,
          reason: editReason || undefined
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update connection')
      }

      toast.success('Connection updated successfully')
      setEditingConnection(null)
      setEditReason('')
      await loadConnections()
    } catch (error) {
      console.error('Error updating connection:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update connection')
    }
  }

  useEffect(() => {
    loadConnections()
  }, [sparkId])

  const getConnectionTypeColor = (type: ConnectionType) => {
    switch (type) {
      case ConnectionType.DEPENDS_ON: return 'bg-orange-500/10 text-orange-700 border-orange-500/20'
      case ConnectionType.INSPIRES: return 'bg-purple-500/10 text-purple-700 border-purple-500/20'
      case ConnectionType.CONFLICTS_WITH: return 'bg-red-500/10 text-red-700 border-red-500/20'
      default: return 'bg-blue-500/10 text-blue-700 border-blue-500/20'
    }
  }

  const getConnectionTypeLabel = (type: ConnectionType) => {
    return CONNECTION_TYPES.find(t => t.value === type)?.label || type
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              {sparkId ? 'Spark Connections' : 'All Connections'}
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
              >
                <History className="h-4 w-4 mr-2" />
                History
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadConnections}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading connections...</span>
            </div>
          ) : connections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Link2 className="h-12 w-12 mb-2 opacity-50" />
              <p>No connections found</p>
              <p className="text-sm">Create connections to link your sparks together</p>
            </div>
          ) : (
            <div className="space-y-4">
              {connections.map((connection) => (
                <div key={connection.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getConnectionTypeColor(connection.type)}>
                          {getConnectionTypeLabel(connection.type)}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(connection.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3 mb-2">
                        {connection.spark1 && (
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: connection.spark1.color }}
                            />
                            <span className="font-medium">{connection.spark1.title}</span>
                          </div>
                        )}
                        <span className="text-muted-foreground">→</span>
                        {connection.spark2 && (
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: connection.spark2.color }}
                            />
                            <span className="font-medium">{connection.spark2.title}</span>
                          </div>
                        )}
                      </div>
                      
                      {connection.metadata && Object.keys(connection.metadata).length > 0 && (
                        <div className="text-sm text-muted-foreground">
                          Additional data: {JSON.stringify(connection.metadata)}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Eye className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Connection History</DialogTitle>
                            <DialogDescription>
                              View the complete history for this connection
                            </DialogDescription>
                          </DialogHeader>
                          <ConnectionHistoryViewer 
                            connectionId={connection.id}
                            className="border-0 shadow-none"
                          />
                        </DialogContent>
                      </Dialog>

                      <Dialog open={editingConnection?.id === connection.id} onOpenChange={(open) => {
                        if (!open) {
                          setEditingConnection(null)
                          setEditReason('')
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setEditingConnection(connection)
                              setEditType(connection.type)
                            }}
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Connection</DialogTitle>
                            <DialogDescription>
                              Modify the connection type and add a reason for the change
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div>
                              <Label htmlFor="connection-type">Connection Type</Label>
                              <Select value={editType} onValueChange={(value: ConnectionType) => setEditType(value)}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {CONNECTION_TYPES.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                      <div>
                                        <div className="font-medium">{type.label}</div>
                                        <div className="text-xs text-muted-foreground">{type.description}</div>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="edit-reason">Reason (optional)</Label>
                              <Textarea
                                id="edit-reason"
                                placeholder="Why are you making this change?"
                                value={editReason}
                                onChange={(e) => setEditReason(e.target.value)}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setEditingConnection(null)}>
                              Cancel
                            </Button>
                            <Button onClick={handleEditConnection}>
                              Update Connection
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeleteConnection(connection.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showHistory && (
        <>
          <Separator className="my-6" />
          <ConnectionHistoryViewer 
            sparkIds={sparkId ? [sparkId] : undefined}
            className="mt-6"
          />
        </>
      )}
    </div>
  )
}