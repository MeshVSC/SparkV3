
 "use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { useRef } from 'react';
import { Search, Filter, X, Tag, Calendar, Sparkles, Settings } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Spark, SparkStatus } from "@/types/spark"
import { useSpark } from "@/contexts/spark-context"
import { useUser } from "@/contexts/user-context"
import { searchService, SearchOptions } from "@/lib/search-service"
import { getSearchHistory } from "@/lib/search-history"
import { SmartSearchSuggestions } from "@/components/smart-search-suggestions"
import { SearchHistoryManager } from "@/components/search-history-manager"

interface SearchFilters {
  query: string
  tags: string[]
  status: SparkStatus | "all"
  dateFrom?: Date
  dateTo?: Date
  xpRange: [number, number]
}

interface SearchConfig {
  threshold: number
  includeMatches: boolean
  fuzzySearch: boolean
}

interface AdvancedSearchProps {
  onFiltersChange: (filteredSparks: Spark[]) => void
}

export function AdvancedSearch({ onFiltersChange }: AdvancedSearchProps) {
  const { state } = useSpark()
  const { user } = useUser()
  const [filters, setFilters] = useState<SearchFilters>({
    query: "",
    tags: [],
    status: "all",
    xpRange: [0, 1000]
  })
  const [showFilters, setShowFilters] = useState(false)
  const [showSearchConfig, setShowSearchConfig] = useState(false)
  const [searchConfig, setSearchConfig] = useState<SearchConfig>({
    threshold: 0.6,
    includeMatches: true,
    fuzzySearch: true
  })

  // Initialize search service with sparks data
  useEffect(() => {
    if (state.sparks.length > 0) {
      searchService.indexSparks(state.sparks)
    }
  }, [state.sparks])

  // Update search service options when config changes
  useEffect(() => {
    const options: Partial<SearchOptions> = {
      threshold: searchConfig.fuzzySearch ? searchConfig.threshold : 0.0,
      includeMatches: searchConfig.includeMatches,
      includeScore: true
    }
    searchService.updateOptions(options)
  }, [searchConfig])

  // Extract unique tags from all sparks
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>()
    state.sparks.forEach(spark => {
      if (spark.tags) {
        try {
          const sparkTags = JSON.parse(spark.tags) as string[]
          sparkTags.forEach(tag => tagSet.add(tag))
        } catch (e) {
          // Handle string tags
          spark.tags.split(',').forEach(tag => tagSet.add(tag.trim()))
        }
      }
    })
    return Array.from(tagSet).filter(Boolean)
  }, [state.sparks])

  // Advanced search using SearchService
  const filteredSparks = useMemo(() => {
    console.log('[AdvancedSearch] filteredSparks useMemo recalculating:', {
      timestamp: new Date().toISOString(),
      sparksLength: state.sparks.length,
      filters,
      searchConfig
    })
    
    if (state.sparks.length === 0) return []

    // Use the SearchService for advanced fuzzy search
    const searchResults = searchService.advancedSearch(filters.query, {
      tags: filters.tags.length > 0 ? filters.tags : undefined,
      status: filters.status !== "all" ? filters.status : undefined,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      xpRange: filters.xpRange[0] > 0 || filters.xpRange[1] < 1000 ? filters.xpRange : undefined
    })

    // Extract sparks from search results and sort by relevance score
    const result = searchResults
      .sort((a, b) => (a.score || 0) - (b.score || 0)) // Lower score = better match in Fuse.js
      .map(result => result.item)
    
    console.log('[AdvancedSearch] filteredSparks useMemo result:', {
      timestamp: new Date().toISOString(),
      resultLength: result.length
    })
    
    return result
  }, [state.sparks, filters, searchConfig])

  // Handle search with history tracking
  const handleSearch = useCallback((query: string, searchFilters?: Record<string, any>) => {
    const finalFilters = { ...filters, query }
    if (searchFilters) {
      Object.assign(finalFilters, searchFilters)
    }

    console.log('[AdvancedSearch] handleSearch setFilters:', {
      timestamp: new Date().toISOString(),
      finalFilters,
      query
    })
    setFilters(finalFilters)

    // Add to local search history
    getSearchHistory().addSearch(query, filteredSparks.length, finalFilters)

    // Add to database search history if user is logged in
    if (user?.id && query.trim()) {
      fetch('/api/search/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id,
          query: query.trim(),
          filters: finalFilters,
          resultCount: filteredSparks.length
        })
      }).catch(error => console.error('Failed to save search history:', error))
    }
  }, [filters, user?.id, filteredSparks.length])

  const updateFilters = useCallback((updates: Partial<SearchFilters>) => {
    console.log('[AdvancedSearch] updateFilters called:', {
      timestamp: new Date().toISOString(),
      updates
    })
    setFilters(prev => ({ ...prev, ...updates }))
  }, [])

  const handleQueryChange = useCallback((value: string) => {
    updateFilters({ query: value })
  }, [updateFilters])

  // Only notify parent when filteredSparks actually changes (avoid double loop with Sidebar)
  const prevFilteredSparksRef = useRef<typeof filteredSparks>();

  useEffect(() => {
    console.log('[AdvancedSearch] useEffect onFiltersChange triggered:', {
      timestamp: new Date().toISOString(),
      filteredSparksLength: filteredSparks.length,
      prevLength: prevFilteredSparksRef.current?.length || 0,
      hasChanged: JSON.stringify(prevFilteredSparksRef.current) !== JSON.stringify(filteredSparks)
    })
    
    if (JSON.stringify(prevFilteredSparksRef.current) !== JSON.stringify(filteredSparks)) {
      console.log('[AdvancedSearch] Calling onFiltersChange:', {
        timestamp: new Date().toISOString(),
        filteredSparks: filteredSparks.map(s => ({ id: s.id, title: s.title }))
      })
      onFiltersChange(filteredSparks);
      prevFilteredSparksRef.current = filteredSparks;
    }
  }, [filteredSparks, onFiltersChange]);

  const addTag = useCallback((tag: string) => {
    if (!filters.tags.includes(tag)) {
      updateFilters({ tags: [...filters.tags, tag] })
    }
  }, [filters.tags, updateFilters])

  const removeTag = useCallback((tag: string) => {
    updateFilters({ tags: filters.tags.filter(t => t !== tag) })
  }, [filters.tags, updateFilters])

  const clearAllFilters = useCallback(() => {
    setFilters({
      query: "",
      tags: [],
      status: "all",
      xpRange: [0, 1000]
    })
  }, [])

  const hasActiveFilters = filters.query || filters.tags.length > 0 ||
    filters.status !== "all" || filters.dateFrom || filters.dateTo ||
    filters.xpRange[0] > 0 || filters.xpRange[1] < 1000

  return (
    <div className="space-y-4">
      {/* Smart Search Bar with Suggestions */}
      <div className="flex gap-2 items-center">
        <div className="flex-1">
          <SmartSearchSuggestions
            value={filters.query}
            onChange={handleQueryChange}
            onSearch={handleSearch}
            placeholder="Search sparks, todos, content..."
            showSaveSearch={!!user?.id}
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSearchConfig(!showSearchConfig)}
          title="Search Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* Search Configuration */}
      {showSearchConfig && (
        <div className="p-4 border rounded-lg bg-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Search Settings</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchConfig({
                threshold: 0.6,
                includeMatches: true,
                fuzzySearch: true
              })}
            >
              Reset
            </Button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="fuzzy-search">Fuzzy Search</Label>
              <Switch
                id="fuzzy-search"
                checked={searchConfig.fuzzySearch}
                onCheckedChange={(checked) =>
                  setSearchConfig(prev => ({ ...prev, fuzzySearch: checked }))
                }
              />
            </div>

            {searchConfig.fuzzySearch && (
              <div className="space-y-2">
                <Label>Match Sensitivity: {Math.round((1 - searchConfig.threshold) * 100)}%</Label>
                <Slider
                  value={[searchConfig.threshold]}
                  onValueChange={([value]) =>
                    setSearchConfig(prev => ({ ...prev, threshold: value }))
                  }
                  min={0.1}
                  max={0.9}
                  step={0.1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Exact</span>
                  <span>Fuzzy</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label htmlFor="include-matches">Highlight Matches</Label>
              <Switch
                id="include-matches"
                checked={searchConfig.includeMatches}
                onCheckedChange={(checked) =>
                  setSearchConfig(prev => ({ ...prev, includeMatches: checked }))
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* Advanced Filters */}
      {showFilters && (
        <div className="p-4 border rounded-lg bg-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Advanced Filters</h3>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearAllFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select
              value={filters.status}
              onValueChange={(value) => updateFilters({ status: value as SparkStatus | "all" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="SEEDLING">🌱 Seedling</SelectItem>
                <SelectItem value="SAPLING">🌿 Sapling</SelectItem>
                <SelectItem value="TREE">🌳 Tree</SelectItem>
                <SelectItem value="FOREST">🌲 Forest</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tag Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Tags</label>
            <div className="flex flex-wrap gap-2">
              {availableTags.map(tag => (
                <Badge
                  key={tag}
                  variant={filters.tags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => filters.tags.includes(tag) ? removeTag(tag) : addTag(tag)}
                >
                  <Tag className="h-3 w-3 mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>
            {filters.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                <span className="text-sm text-muted-foreground">Selected:</span>
                {filters.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                    {tag}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Date Range Filter */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">From Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <Calendar className="h-4 w-4 mr-2" />
                    {filters.dateFrom ? filters.dateFrom.toLocaleDateString() : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent>
                  <CalendarComponent
                    mode="single"
                    selected={filters.dateFrom}
                    onSelect={(date) => updateFilters({ dateFrom: date })}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">To Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <Calendar className="h-4 w-4 mr-2" />
                    {filters.dateTo ? filters.dateTo.toLocaleDateString() : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent>
                  <CalendarComponent
                    mode="single"
                    selected={filters.dateTo}
                    onSelect={(date) => updateFilters({ dateTo: date })}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      )}

      {/* Results Summary */}
      {(hasActiveFilters || filters.query.trim()) && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            Found {filteredSparks.length} spark{filteredSparks.length !== 1 ? 's' : ''}
            {filters.query.trim() && ` for "${filters.query}"`}
          </div>
          {searchConfig.fuzzySearch && filters.query.trim() && (
            <div className="text-xs text-muted-foreground">
              Fuzzy: {Math.round((1 - searchConfig.threshold) * 100)}% match
            </div>
          )}
          <SearchHistoryManager onSelectSearch={handleSearch} />
        </div>
      )}
    </div>
  )
}
