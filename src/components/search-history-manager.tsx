"use client"

import { useState, useEffect, useCallback } from "react"
import { History, X, Trash2, Search, Clock, TrendingUp, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getSearchHistory, LocalSearchHistoryItem } from "@/lib/search-history"
import { useUser } from "@/contexts/user-context"

interface SearchHistoryItem {
  id: string
  query: string
  filters?: Record<string, any>
  resultCount?: number
  createdAt: string
}

interface SavedSearchItem {
  id: string
  name: string
  query: string
  filters?: Record<string, any>
  tags?: string[]
  lastUsedAt?: string
  createdAt: string
}

interface SearchHistoryManagerProps {
  onSelectSearch: (query: string, filters?: Record<string, any>) => void
}

export function SearchHistoryManager({ onSelectSearch }: SearchHistoryManagerProps) {
  const { user } = useUser()
  const [isOpen, setIsOpen] = useState(false)
  const [localHistory, setLocalHistory] = useState<LocalSearchHistoryItem[]>([])
  const [dbHistory, setDbHistory] = useState<SearchHistoryItem[]>([])
  const [savedSearches, setSavedSearches] = useState<SavedSearchItem[]>([])
  const [filterQuery, setFilterQuery] = useState("")
  const [activeTab, setActiveTab] = useState("local")

  // Load local history
  useEffect(() => {
    const history = getSearchHistory().getHistory(50)
    setLocalHistory(history)
  }, [isOpen])

  // Load database history and saved searches
  useEffect(() => {
    if (user?.id && isOpen) {
      loadDbHistory()
      loadSavedSearches()
    }
  }, [user?.id, isOpen])

  const loadDbHistory = async () => {
    if (!user?.id) return
    
    try {
      const response = await fetch(`/api/search/history?userId=${user.id}&limit=50`)
      if (response.ok) {
        const data = await response.json()
        setDbHistory(data)
      }
    } catch (error) {
      console.error('Failed to load database search history:', error)
    }
  }

  const loadSavedSearches = async () => {
    if (!user?.id) return
    
    try {
      const response = await fetch(`/api/search/saved?userId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        setSavedSearches(data)
      }
    } catch (error) {
      console.error('Failed to load saved searches:', error)
    }
  }

  const handleSelectLocalSearch = useCallback((item: LocalSearchHistoryItem) => {
    onSelectSearch(item.query, item.filters)
    setIsOpen(false)
  }, [onSelectSearch])

  const handleSelectDbSearch = useCallback((item: SearchHistoryItem) => {
    onSelectSearch(item.query, item.filters || undefined)
    setIsOpen(false)
  }, [onSelectSearch])

  const handleSelectSavedSearch = useCallback(async (item: SavedSearchItem) => {
    // Update last used timestamp
    if (user?.id) {
      try {
        await fetch('/api/search/saved', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: item.id,
            userId: user.id,
            lastUsedAt: new Date().toISOString()
          })
        })
      } catch (error) {
        console.error('Failed to update saved search:', error)
      }
    }
    
    onSelectSearch(item.query, item.filters || undefined)
    setIsOpen(false)
  }, [onSelectSearch, user?.id])

  const removeLocalHistory = useCallback((id: string) => {
    getSearchHistory().removeSearch(id)
    setLocalHistory(getSearchHistory().getHistory(50))
  }, [])

  const clearLocalHistory = useCallback(() => {
    getSearchHistory().clearHistory()
    setLocalHistory([])
  }, [])

  const removeDbHistory = useCallback(async (id: string) => {
    if (!user?.id) return
    
    try {
      await fetch(`/api/search/history?id=${id}&userId=${user.id}`, {
        method: 'DELETE'
      })
      await loadDbHistory()
    } catch (error) {
      console.error('Failed to remove search history:', error)
    }
  }, [user?.id, loadDbHistory])

  const clearDbHistory = useCallback(async () => {
    if (!user?.id) return
    
    try {
      await fetch(`/api/search/history?userId=${user.id}`, {
        method: 'DELETE'
      })
      setDbHistory([])
    } catch (error) {
      console.error('Failed to clear search history:', error)
    }
  }, [user?.id])

  const deleteSavedSearch = useCallback(async (id: string) => {
    if (!user?.id) return
    
    try {
      await fetch(`/api/search/saved?id=${id}&userId=${user.id}`, {
        method: 'DELETE'
      })
      await loadSavedSearches()
    } catch (error) {
      console.error('Failed to delete saved search:', error)
    }
  }, [user?.id, loadSavedSearches])

  // Filter functions
  const filteredLocalHistory = localHistory.filter(item =>
    item.query.toLowerCase().includes(filterQuery.toLowerCase())
  )

  const filteredDbHistory = dbHistory.filter(item =>
    item.query.toLowerCase().includes(filterQuery.toLowerCase())
  )

  const filteredSavedSearches = savedSearches.filter(item =>
    item.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
    item.query.toLowerCase().includes(filterQuery.toLowerCase())
  )

  const formatRelativeTime = (timestamp: number | string) => {
    const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  const getPopularQueries = () => {
    return getSearchHistory().getPopularQueries(5)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <History className="h-4 w-4" />
          Search History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Search History & Saved Searches</DialogTitle>
          <DialogDescription>
            Manage your search history and access your saved searches quickly
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Filter */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Filter searches..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="local" className="gap-2">
                <Clock className="h-4 w-4" />
                Local ({localHistory.length})
              </TabsTrigger>
              {user?.id && (
                <>
                  <TabsTrigger value="cloud" className="gap-2">
                    <History className="h-4 w-4" />
                    Cloud ({dbHistory.length})
                  </TabsTrigger>
                  <TabsTrigger value="saved" className="gap-2">
                    <Star className="h-4 w-4" />
                    Saved ({savedSearches.length})
                  </TabsTrigger>
                </>
              )}
            </TabsList>

            {/* Local History */}
            <TabsContent value="local" className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium">Recent Local Searches</h3>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={clearLocalHistory}
                  disabled={filteredLocalHistory.length === 0}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear All
                </Button>
              </div>

              {/* Popular Queries */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase">Popular</h4>
                <div className="flex flex-wrap gap-2">
                  {getPopularQueries().map((query, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => handleSelectLocalSearch({ id: '', query, timestamp: Date.now() })}
                    >
                      <TrendingUp className="h-3 w-3 mr-1" />
                      {query}
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator />

              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {filteredLocalHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {filterQuery ? 'No matching searches found' : 'No search history yet'}
                    </p>
                  ) : (
                    filteredLocalHistory.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 border rounded-lg hover:bg-accent group"
                      >
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => handleSelectLocalSearch(item)}
                        >
                          <div className="font-medium text-sm">{item.query}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatRelativeTime(item.timestamp)}
                            {item.resultCount !== undefined && (
                              <span className="ml-2">• {item.resultCount} results</span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100"
                          onClick={() => removeLocalHistory(item.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Cloud History */}
            {user?.id && (
              <TabsContent value="cloud" className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-medium">Cloud Search History</h3>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={clearDbHistory}
                    disabled={filteredDbHistory.length === 0}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                </div>

                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {filteredDbHistory.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {filterQuery ? 'No matching searches found' : 'No cloud search history yet'}
                      </p>
                    ) : (
                      filteredDbHistory.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 border rounded-lg hover:bg-accent group"
                        >
                          <div 
                            className="flex-1 cursor-pointer"
                            onClick={() => handleSelectDbSearch(item)}
                          >
                            <div className="font-medium text-sm">{item.query}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatRelativeTime(item.createdAt)}
                              {item.resultCount !== undefined && (
                                <span className="ml-2">• {item.resultCount} results</span>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100"
                            onClick={() => removeDbHistory(item.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            )}

            {/* Saved Searches */}
            {user?.id && (
              <TabsContent value="saved" className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-medium">Saved Searches</h3>
                </div>

                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {filteredSavedSearches.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {filterQuery ? 'No matching saved searches found' : 'No saved searches yet'}
                      </p>
                    ) : (
                      filteredSavedSearches.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 border rounded-lg hover:bg-accent group"
                        >
                          <div 
                            className="flex-1 cursor-pointer"
                            onClick={() => handleSelectSavedSearch(item)}
                          >
                            <div className="font-medium text-sm">{item.name}</div>
                            <div className="text-xs text-muted-foreground mb-1">{item.query}</div>
                            <div className="text-xs text-muted-foreground">
                              Created {formatRelativeTime(item.createdAt)}
                              {item.lastUsedAt && (
                                <span className="ml-2">• Used {formatRelativeTime(item.lastUsedAt)}</span>
                              )}
                            </div>
                            {item.tags && item.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {item.tags.slice(0, 3).map((tag, index) => (
                                  <Badge key={index} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100"
                            onClick={() => deleteSavedSearch(item.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}