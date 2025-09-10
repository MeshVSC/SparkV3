import Fuse from 'fuse.js';
import { Spark } from '@/types/spark';

export interface SearchResult {
  item: Spark;
  refIndex: number;
  score?: number;
}

export interface SearchOptions {
  threshold?: number;
  includeScore?: boolean;
  includeMatches?: boolean;
  minMatchCharLength?: number;
  shouldSort?: boolean;
  findAllMatches?: boolean;
  keys?: Array<{
    name: string;
    weight: number;
  }>;
}

const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  threshold: 0.6, // 0.0 requires perfect match, 1.0 would match anything
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 1,
  shouldSort: true,
  findAllMatches: false,
  keys: [
    { name: 'title', weight: 0.4 }, // Highest priority
    { name: 'description', weight: 0.3 },
    { name: 'content', weight: 0.2 },
    { name: 'todos.title', weight: 0.15 },
    { name: 'todos.description', weight: 0.1 },
    { name: 'attachments.filename', weight: 0.1 },
    { name: 'parsedTags', weight: 0.25 } // Medium priority for tags
  ]
};

export class SearchService {
  private fuse: Fuse<Spark> | null = null;
  private searchOptions: SearchOptions;
  private sparks: Spark[] = [];

  constructor(options: Partial<SearchOptions> = {}) {
    this.searchOptions = { ...DEFAULT_SEARCH_OPTIONS, ...options };
  }

  /**
   * Initialize or update the search index with spark data
   */
  public indexSparks(sparks: Spark[]): void {
    // Transform sparks to include parsed tags for easier searching
    const indexedSparks = sparks.map(spark => ({
      ...spark,
      parsedTags: this.parseTags(spark.tags),
      // Flatten todos for better searching
      todosText: spark.todos?.map(todo => `${todo.title} ${todo.description || ''}`).join(' ') || '',
      // Flatten attachments
      attachmentsText: spark.attachments?.map(att => att.filename).join(' ') || ''
    }));

    this.sparks = indexedSparks;

    // Create new Fuse instance with updated data
    this.fuse = new Fuse(indexedSparks, {
      threshold: this.searchOptions.threshold,
      includeScore: this.searchOptions.includeScore,
      includeMatches: this.searchOptions.includeMatches,
      minMatchCharLength: this.searchOptions.minMatchCharLength,
      shouldSort: this.searchOptions.shouldSort,
      findAllMatches: this.searchOptions.findAllMatches,
      keys: [
        ...(this.searchOptions.keys || DEFAULT_SEARCH_OPTIONS.keys || []),
        { name: 'todosText', weight: 0.15 },
        { name: 'attachmentsText', weight: 0.1 }
      ]
    });
  }

  /**
   * Perform a fuzzy search across all indexed spark data
   */
  public search(query: string, options?: Partial<SearchOptions>): SearchResult[] {
    if (!this.fuse || !query.trim()) {
      return [];
    }

    const searchOptions = { ...this.searchOptions, ...options };

    return this.fuse.search(query, {
      limit: searchOptions.findAllMatches ? Number.MAX_SAFE_INTEGER : 50
    }) as SearchResult[];
  }

  /**
   * Get search suggestions based on partial query
   */
  public getSuggestions(query: string, limit: number = 5): string[] {
    if (!query.trim() || query.length < 2) {
      return [];
    }

    const results = this.search(query, { threshold: 0.3 });
    const suggestions = new Set<string>();

    results.slice(0, limit * 2).forEach(result => {
      const spark = result.item;

      // Extract suggestions from titles
      if (spark.title.toLowerCase().includes(query.toLowerCase())) {
        suggestions.add(spark.title);
      }

      // Extract suggestions from tags
      this.parseTags(spark.tags).forEach(tag => {
        if (tag.toLowerCase().includes(query.toLowerCase())) {
          suggestions.add(tag);
        }
      });
    });

    return Array.from(suggestions).slice(0, limit);
  }

  /**
   * Get search results with advanced filtering
   */
  public advancedSearch(
    query: string,
    filters: {
      tags?: string[];
      status?: string;
      dateFrom?: Date;
      dateTo?: Date;
      xpRange?: [number, number];
    } = {}
  ): SearchResult[] {
    let results: SearchResult[];

    if (query.trim()) {
      results = this.search(query);
    } else {
      // If no query, return all sparks as results
      results = this.sparks.map((spark, index) => ({
        item: spark,
        refIndex: index,
        score: 0
      }));
    }

    // Apply filters
    return results.filter(result => {
      const spark = result.item;

      // Tag filtering
      if (filters.tags && filters.tags.length > 0) {
        const sparkTags = this.parseTags(spark.tags);
        const hasMatchingTag = filters.tags.some(filterTag =>
          sparkTags.some(sparkTag =>
            sparkTag.toLowerCase().includes(filterTag.toLowerCase())
          )
        );
        if (!hasMatchingTag) return false;
      }

      // Status filtering
      if (filters.status && filters.status !== 'all') {
        if (spark.status !== filters.status) return false;
      }

      // Date filtering
      if (filters.dateFrom) {
        if (new Date(spark.createdAt) < filters.dateFrom) return false;
      }
      if (filters.dateTo) {
        if (new Date(spark.createdAt) > filters.dateTo) return false;
      }

      // XP range filtering
      if (filters.xpRange) {
        const [min, max] = filters.xpRange;
        if (spark.xp < min || spark.xp > max) return false;
      }

      return true;
    });
  }

  /**
   * Update search configuration
   */
  public updateOptions(options: Partial<SearchOptions>): void {
    this.searchOptions = { ...this.searchOptions, ...options };

    // Re-index with new options if we have data
    if (this.sparks.length > 0) {
      this.indexSparks(this.sparks);
    }
  }

  /**
   * Get current search statistics
   */
  public getStats(): {
    totalSparks: number;
    indexed: boolean;
    searchOptions: SearchOptions;
  } {
    return {
      totalSparks: this.sparks.length,
      indexed: this.fuse !== null,
      searchOptions: this.searchOptions
    };
  }

  /**
   * Parse tags from string format to array
   */
  private parseTags(tags?: string): string[] {
    if (!tags) return [];

    try {
      // Try parsing as JSON first
      const parsed = JSON.parse(tags);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      // Fallback to comma-separated string
      return tags.split(',').map(tag => tag.trim()).filter(Boolean);
    }
  }

  /**
   * Clear the search index
   */
  public clear(): void {
    this.fuse = null;
    this.sparks = [];
  }
}

// Create a default export instance
export const searchService = new SearchService();
