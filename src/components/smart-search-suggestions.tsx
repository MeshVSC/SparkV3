"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Search, History, Star, Tag, Sparkles, Clock, TrendingUp, X, Bookmark, BookmarkPlus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useSpark } from "@/contexts/spark-context"
import { getSearchHistory } from "@/lib/search-history"
import { searchService } from "@/lib/search-service"
import { useUser } from "@/contexts/user-context"
import { useDebounce } from "@/hooks/use-debounce"

interface SavedSearch {
  id: string
  name: string
  query: string
  filters?: Record<string, any>
  tags?: string[]
  lastUsedAt?: Date
}

interface SmartSuggestion {
  id: string
  text: string
  type: 'history' | 'saved' | 'tag' | 'spark' | 'content' | 'popular'
  icon: React.ReactNode
  category: string
  metadata?: Record<string, any>
}

interface SmartSearchSuggestionsProps {
  value: string
  onChange: (value: string) => void
  onSearch: (query: string, filters?: Record<string, any>) => void
  placeholder?: string
  className?: string
  showSaveSearch?: boolean
}

export function SmartSearchSuggestions({
  value,
  onChange,
  onSearch,
  placeholder = "Search sparks, content, tags...",
  className = "",
  showSaveSearch = true
}: SmartSearchSuggestionsProps) {
  const { state } = useSpark()
  const { user } = useUser()
  const [isOpen, setIsOpen] = useState(false)
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveSearchName, setSaveSearchName] = useState("")
  
  // Debounce the search query to avoid excessive API calls
  const debouncedValue = useDebounce(value, 300)

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

  // Load saved searches on mount
  useEffect(() => {
    if (user?.id) {
      loadSavedSearches()
    }
  }, [user?.id])

  // Generate contextual suggestions based on current spark content and user activity
  const contextualSuggestions = useMemo((): SmartSuggestion[] => {
    const suggestions: SmartSuggestion[] = []
    
    // Get unique tags from all sparks
    const allTags = new Set<string>()
    const sparkTitles: string[] = []
    const recentSparks = state.sparks
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 10)

    state.sparks.forEach(spark => {
      sparkTitles.push(spark.title)
      if (spark.tags) {
        try {
          const tags = JSON.parse(spark.tags) as string[]
          tags.forEach(tag => allTags.add(tag))
        } catch {
          spark.tags.split(',').forEach(tag => allTags.add(tag.trim()))
        }
      }
    })

    // Popular tags (most frequently used)
    const tagFrequency = new Map<string, number>()
    Array.from(allTags).forEach(tag => {
      const count = state.sparks.filter(spark => {
        if (!spark.tags) return false
        try {
          const tags = JSON.parse(spark.tags) as string[]
          return tags.includes(tag)
        } catch {
          return spark.tags.includes(tag)
        }
      }).length
      tagFrequency.set(tag, count)
    })

    // Add popular tags as suggestions
    Array.from(tagFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([tag, count]) => {
        suggestions.push({
          id: `tag-${tag}`,
          text: tag,
          type: 'tag',
          icon: <Tag className="h-4 w-4" />,
          category: 'Popular Tags',
          metadata: { count }
        })
      })

    // Recent spark titles
    recentSparks.slice(0, 3).forEach(spark => {
      suggestions.push({
        id: `spark-${spark.id}`,
        text: spark.title,
        type: 'spark',
        icon: <Sparkles className="h-4 w-4" />,
        category: 'Recent Sparks',
        metadata: { sparkId: spark.id, status: spark.status }
      })
    })

    return suggestions
  }, [state.sparks])

  // Generate smart suggestions based on input
  const smartSuggestions = useMemo((): SmartSuggestion[] => {
    if (!debouncedValue || debouncedValue.length < 2) {
      // Show contextual suggestions when no query
      const suggestions: SmartSuggestion[] = []
      
      // Recent search history
      const recentQueries = getSearchHistory().getRecentQueries(3)
      recentQueries.forEach(query => {
        suggestions.push({
          id: `history-${query}`,
          text: query,
          type: 'history',
          icon: <History className="h-4 w-4" />,
          category: 'Recent Searches'
        })
      })

      // Saved searches
      savedSearches.slice(0, 3).forEach(saved => {
        suggestions.push({
          id: `saved-${saved.id}`,
          text: saved.query,
          type: 'saved',
          icon: <Star className="h-4 w-4" />,
          category: 'Saved Searches',
          metadata: saved
        })
      })

      // Popular queries
      const popularQueries = getSearchHistory().getPopularQueries(2)
      popularQueries.forEach(query => {
        suggestions.push({
          id: `popular-${query}`,
          text: query,
          type: 'popular',
          icon: <TrendingUp className="h-4 w-4" />,
          category: 'Popular Searches'
        })
      })

      return [...suggestions, ...contextualSuggestions]
    }

    const suggestions: SmartSuggestion[] = []
    const lowerQuery = debouncedValue.toLowerCase()

    // Search history suggestions
    const historySuggestions = getSearchHistory().getSuggestions(debouncedValue, 3)
    historySuggestions.forEach(query => {
      if (query.toLowerCase() !== lowerQuery) {
        suggestions.push({
          id: `history-${query}`,
          text: query,
          type: 'history',
          icon: <History className="h-4 w-4" />,
          category: 'Search History'
        })
      }
    })

    // Saved search suggestions
    savedSearches
      .filter(saved => saved.query.toLowerCase().includes(lowerQuery))
      .slice(0, 2)
      .forEach(saved => {
        suggestions.push({
          id: `saved-${saved.id}`,
          text: saved.query,
          type: 'saved',
          icon: <Star className="h-4 w-4" />,
          category: 'Saved Searches',
          metadata: saved
        })
      })

    // Content-based suggestions from search service
    const contentSuggestions = searchService.getSuggestions(debouncedValue, 3)
    contentSuggestions.forEach(suggestion => {
      if (suggestion.toLowerCase() !== lowerQuery) {
        suggestions.push({
          id: `content-${suggestion}`,
          text: suggestion,
          type: 'content',
          icon: <Search className="h-4 w-4" />,
          category: 'Content Matches'
        })
      }
    })

    // Contextual suggestions that match query
    const filteredContextual = contextualSuggestions.filter(
      suggestion => suggestion.text.toLowerCase().includes(lowerQuery)
    )

    return [...suggestions, ...filteredContextual.slice(0, 3)]
  }, [debouncedValue, savedSearches, contextualSuggestions])

  const handleSuggestionSelect = useCallback((suggestion: SmartSuggestion) => {
    onChange(suggestion.text)
    setIsOpen(false)
    
    // Execute search with suggestion
    if (suggestion.type === 'saved' && suggestion.metadata) {
      onSearch(suggestion.text, suggestion.metadata.filters)
    } else {
      onSearch(suggestion.text)
    }
    
    // Add to search history
    getSearchHistory().addSearch(suggestion.text)
  }, [onChange, onSearch])

  const handleInputChange = useCallback((newValue: string) => {
    onChange(newValue)
    setIsOpen(newValue.length > 0 || smartSuggestions.length > 0)
  }, [onChange, smartSuggestions.length])

  const handleSearch = useCallback(() => {
    if (value.trim()) {
      onSearch(value)
      getSearchHistory().addSearch(value)
      setIsOpen(false)
    }
  }, [value, onSearch])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch()
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }, [handleSearch])

  const saveCurrentSearch = useCallback(async () => {
    if (!user?.id || !value.trim() || !saveSearchName.trim()) return
    
    try {
      const response = await fetch('/api/search/saved', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id,
          name: saveSearchName.trim(),
          query: value.trim()
        })
      })

      if (response.ok) {
        await loadSavedSearches()
        setShowSaveDialog(false)
        setSaveSearchName("")
      }
    } catch (error) {
      console.error('Failed to save search:', error)
    }
  }, [user?.id, value, saveSearchName, loadSavedSearches])

  const groupedSuggestions = useMemo(() => {
    const grouped = smartSuggestions.reduce((acc, suggestion) => {
      const category = suggestion.category
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(suggestion)
      return acc
    }, {} as Record<string, SmartSuggestion[]>)

    return grouped
  }, [smartSuggestions])

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(smartSuggestions.length > 0)}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
          placeholder={placeholder}
          className="pl-10 pr-12"
        />
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {showSaveSearch && value.trim() && user?.id && (
            <Popover open={showSaveDialog} onOpenChange={setShowSaveDialog}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <BookmarkPlus className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <h4 className="font-medium">Save Search</h4>
                    <p className="text-sm text-muted-foreground">
                      Save "{value}" for quick access later
                    </p>
                  </div>
                  <Input
                    placeholder="Enter a name for this search..."
                    value={saveSearchName}
                    onChange={(e) => setSaveSearchName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveCurrentSearch()}
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={saveCurrentSearch} disabled={!saveSearchName.trim()}>
                      Save
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Smart Suggestions Dropdown */}
      {isOpen && Object.keys(groupedSuggestions).length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-md shadow-lg max-h-96 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-2">
              {Object.entries(groupedSuggestions).map(([category, suggestions]) => (
                <div key={category} className="mb-3 last:mb-0">
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {category}
                  </div>
                  <div className="space-y-1">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground rounded-sm text-sm flex items-center gap-3 group"
                        onMouseDown={() => handleSuggestionSelect(suggestion)}
                      >
                        <span className="text-muted-foreground group-hover:text-accent-foreground">
                          {suggestion.icon}
                        </span>
                        <span className="flex-1">{suggestion.text}</span>
                        {suggestion.metadata?.count && (
                          <Badge variant="secondary" className="text-xs">
                            {suggestion.metadata.count}
                          </Badge>
                        )}
                        {suggestion.type === 'saved' && (
                          <Bookmark className="h-3 w-3 text-muted-foreground" />
                        )}
                      </button>
                    ))}
                  </div>
                  {Object.keys(groupedSuggestions).length > 1 && category !== Object.keys(groupedSuggestions)[Object.keys(groupedSuggestions).length - 1] && (
                    <Separator className="mt-2" />
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}