// Local storage key for search history
const SEARCH_HISTORY_KEY = 'spark-search-history'
const MAX_HISTORY_ITEMS = 100

export interface LocalSearchHistoryItem {
  id: string
  query: string
  timestamp: number
  resultCount?: number
  filters?: Record<string, any>
}

export class LocalSearchHistory {
  private static instance: LocalSearchHistory
  private history: LocalSearchHistoryItem[] = []

  private constructor() {
    this.loadFromStorage()
  }

  static getInstance(): LocalSearchHistory {
    if (!LocalSearchHistory.instance) {
      LocalSearchHistory.instance = new LocalSearchHistory()
    }
    return LocalSearchHistory.instance
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return
    
    try {
      const stored = localStorage.getItem(SEARCH_HISTORY_KEY)
      if (stored) {
        this.history = JSON.parse(stored)
        // Sort by timestamp descending
        this.history.sort((a, b) => b.timestamp - a.timestamp)
      }
    } catch (error) {
      console.error('Failed to load search history:', error)
      this.history = []
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return
    
    try {
      // Keep only the most recent items
      const trimmedHistory = this.history
        .slice(0, MAX_HISTORY_ITEMS)
        .sort((a, b) => b.timestamp - a.timestamp)
      
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(trimmedHistory))
      this.history = trimmedHistory
    } catch (error) {
      console.error('Failed to save search history:', error)
    }
  }

  addSearch(query: string, resultCount?: number, filters?: Record<string, any>): void {
    if (!query.trim()) return

    const item: LocalSearchHistoryItem = {
      id: Date.now().toString(),
      query: query.trim(),
      timestamp: Date.now(),
      resultCount,
      filters
    }

    // Remove duplicate queries (keep most recent)
    this.history = this.history.filter(h => h.query.toLowerCase() !== query.toLowerCase())
    
    // Add new item at the beginning
    this.history.unshift(item)
    
    this.saveToStorage()
  }

  getHistory(limit?: number): LocalSearchHistoryItem[] {
    const result = this.history.slice(0, limit)
    return result.sort((a, b) => b.timestamp - a.timestamp)
  }

  getRecentQueries(limit: number = 10): string[] {
    return this.getHistory(limit).map(item => item.query)
  }

  getSuggestions(query: string, limit: number = 5): string[] {
    if (!query.trim()) return []

    const lowerQuery = query.toLowerCase()
    const suggestions = this.history
      .filter(item => item.query.toLowerCase().includes(lowerQuery))
      .map(item => item.query)
      .slice(0, limit)

    return [...new Set(suggestions)] // Remove duplicates
  }

  removeSearch(id: string): void {
    this.history = this.history.filter(item => item.id !== id)
    this.saveToStorage()
  }

  clearHistory(): void {
    this.history = []
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SEARCH_HISTORY_KEY)
    }
  }

  getPopularQueries(limit: number = 5): string[] {
    // Count query frequency
    const queryCount = new Map<string, number>()
    
    this.history.forEach(item => {
      const query = item.query.toLowerCase()
      queryCount.set(query, (queryCount.get(query) || 0) + 1)
    })

    // Sort by frequency and return top queries
    return Array.from(queryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(entry => entry[0])
  }
}

// Export a function that returns the instance to avoid SSR issues
export const getSearchHistory = () => {
  if (typeof window === 'undefined') {
    // Return a mock instance for SSR
    return {
      addSearch: () => {},
      getHistory: () => [],
      getRecentQueries: () => [],
      getSuggestions: () => [],
      removeSearch: () => {},
      clearHistory: () => {},
      getPopularQueries: () => []
    }
  }
  return LocalSearchHistory.getInstance()
}

export const searchHistory = getSearchHistory()