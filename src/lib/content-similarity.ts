import { Spark, ConnectionType } from "@/types/spark"

export interface SimilarityScore {
  sparkId: string
  score: number
  matchType: 'title' | 'description' | 'content' | 'tags'
  matchText: string
}

export interface ConnectionSuggestion {
  spark: Spark
  score: number
  suggestedType: ConnectionType
  reason: string
  matchType: 'title' | 'description' | 'content' | 'tags'
}

export class ContentSimilarityEngine {
  // Remove common stop words for better similarity matching
  private static stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must', 'shall', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their'
  ])

  /**
   * Clean and normalize text for similarity analysis
   */
  private static normalizeText(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .split(/\s+/)
      .filter(word => word.length > 2 && !this.stopWords.has(word))
  }

  /**
   * Calculate Jaccard similarity between two sets of words
   */
  private static jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
    const intersection = new Set([...set1].filter(x => set2.has(x)))
    const union = new Set([...set1, ...set2])
    return union.size === 0 ? 0 : intersection.size / union.size
  }

  /**
   * Calculate cosine similarity using word frequency vectors
   */
  private static cosineSimilarity(words1: string[], words2: string[]): number {
    const allWords = new Set([...words1, ...words2])
    const vector1: number[] = []
    const vector2: number[] = []

    allWords.forEach(word => {
      vector1.push(words1.filter(w => w === word).length)
      vector2.push(words2.filter(w => w === word).length)
    })

    const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0)
    const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0))
    const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0))

    return magnitude1 === 0 || magnitude2 === 0 ? 0 : dotProduct / (magnitude1 * magnitude2)
  }

  /**
   * Calculate text similarity score using multiple algorithms
   */
  private static calculateTextSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0

    const words1 = this.normalizeText(text1)
    const words2 = this.normalizeText(text2)

    if (words1.length === 0 || words2.length === 0) return 0

    const set1 = new Set(words1)
    const set2 = new Set(words2)

    const jaccard = this.jaccardSimilarity(set1, set2)
    const cosine = this.cosineSimilarity(words1, words2)

    // Weighted combination of similarity metrics
    return (jaccard * 0.4) + (cosine * 0.6)
  }

  /**
   * Analyze spark content for similarity with another spark
   */
  static analyzeSimilarity(spark1: Spark, spark2: Spark): SimilarityScore[] {
    const scores: SimilarityScore[] = []

    // Title similarity
    const titleScore = this.calculateTextSimilarity(spark1.title, spark2.title)
    if (titleScore > 0.1) {
      scores.push({
        sparkId: spark2.id,
        score: titleScore,
        matchType: 'title',
        matchText: spark2.title
      })
    }

    // Description similarity
    if (spark1.description && spark2.description) {
      const descScore = this.calculateTextSimilarity(spark1.description, spark2.description)
      if (descScore > 0.1) {
        scores.push({
          sparkId: spark2.id,
          score: descScore,
          matchType: 'description',
          matchText: spark2.description
        })
      }
    }

    // Content similarity
    if (spark1.content && spark2.content) {
      const contentScore = this.calculateTextSimilarity(spark1.content, spark2.content)
      if (contentScore > 0.1) {
        scores.push({
          sparkId: spark2.id,
          score: contentScore,
          matchType: 'content',
          matchText: spark2.content.substring(0, 100) + '...'
        })
      }
    }

    // Tags similarity
    if (spark1.tags && spark2.tags) {
      try {
        const tags1 = JSON.parse(spark1.tags)
        const tags2 = JSON.parse(spark2.tags)
        const tagString1 = tags1.join(' ')
        const tagString2 = tags2.join(' ')
        const tagScore = this.calculateTextSimilarity(tagString1, tagString2)
        
        if (tagScore > 0.1) {
          scores.push({
            sparkId: spark2.id,
            score: tagScore,
            matchType: 'tags',
            matchText: tags2.slice(0, 3).join(', ')
          })
        }
      } catch {
        // Ignore tag parsing errors
      }
    }

    return scores
  }

  /**
   * Find similar sparks to a given spark
   */
  static findSimilarSparks(targetSpark: Spark, allSparks: Spark[], threshold: number = 0.15): SimilarityScore[] {
    const similarities: SimilarityScore[] = []

    allSparks.forEach(spark => {
      if (spark.id === targetSpark.id) return

      const scores = this.analyzeSimilarity(targetSpark, spark)
      scores.forEach(score => {
        if (score.score >= threshold) {
          similarities.push(score)
        }
      })
    })

    // Sort by score descending and remove duplicates (keep highest score per spark)
    const sparkScores = new Map<string, SimilarityScore>()
    similarities.forEach(score => {
      const existing = sparkScores.get(score.sparkId)
      if (!existing || score.score > existing.score) {
        sparkScores.set(score.sparkId, score)
      }
    })

    return Array.from(sparkScores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10) // Return top 10 matches
  }

  /**
   * Generate connection suggestions based on content similarity
   */
  static generateConnectionSuggestions(targetSpark: Spark, allSparks: Spark[], threshold: number = 0.2): ConnectionSuggestion[] {
    const similarityScores = this.findSimilarSparks(targetSpark, allSparks, threshold)
    const suggestions: ConnectionSuggestion[] = []

    similarityScores.forEach(similarity => {
      const spark = allSparks.find(s => s.id === similarity.sparkId)
      if (!spark) return

      // Skip if connection already exists
      if (targetSpark.connections?.some(conn => 
        conn.sparkId1 === spark.id || conn.sparkId2 === spark.id)) {
        return
      }

      let suggestedType: ConnectionType = ConnectionType.RELATED_TO
      let reason = `Similar ${similarity.matchType}: "${similarity.matchText}"`

      // Suggest connection type based on context
      if (similarity.matchType === 'title' && similarity.score > 0.4) {
        suggestedType = ConnectionType.DEPENDS_ON
        reason = `Highly similar titles suggest dependency`
      } else if (similarity.matchType === 'tags' && similarity.score > 0.5) {
        suggestedType = ConnectionType.RELATED_TO
        reason = `Shared tags: ${similarity.matchText}`
      } else if (similarity.matchType === 'content') {
        if (similarity.matchText.toLowerCase().includes('inspire') || 
            similarity.matchText.toLowerCase().includes('motivat')) {
          suggestedType = ConnectionType.INSPIRES
          reason = `Content suggests inspiration relationship`
        }
      }

      // Consider spark levels and status for suggestion strength
      const levelDiff = Math.abs(targetSpark.level - spark.level)
      let adjustedScore = similarity.score

      // Boost score for similar level sparks
      if (levelDiff <= 1) {
        adjustedScore += 0.1
      }

      // Consider spark status relationships
      if (targetSpark.status === 'SEEDLING' && spark.status !== 'SEEDLING') {
        suggestedType = ConnectionType.DEPENDS_ON
        reason = `More mature spark could guide this seedling`
      } else if (spark.status === 'SEEDLING' && targetSpark.status !== 'SEEDLING') {
        suggestedType = ConnectionType.INSPIRES
        reason = `This spark could inspire the seedling`
      }

      suggestions.push({
        spark,
        score: adjustedScore,
        suggestedType,
        reason,
        matchType: similarity.matchType
      })
    })

    return suggestions.sort((a, b) => b.score - a.score).slice(0, 5)
  }

  /**
   * Analyze potential conflicts between sparks
   */
  static analyzeConflicts(spark1: Spark, spark2: Spark): { hasConflict: boolean; reason?: string } {
    // Check for conflicting keywords in titles/descriptions
    const conflictKeywords = [
      ['start', 'end'], ['begin', 'finish'], ['create', 'delete'], 
      ['add', 'remove'], ['enable', 'disable'], ['open', 'close']
    ]

    const text1 = (spark1.title + ' ' + (spark1.description || '')).toLowerCase()
    const text2 = (spark2.title + ' ' + (spark2.description || '')).toLowerCase()

    for (const [word1, word2] of conflictKeywords) {
      if ((text1.includes(word1) && text2.includes(word2)) ||
          (text1.includes(word2) && text2.includes(word1))) {
        return {
          hasConflict: true,
          reason: `Conflicting actions detected: ${word1} vs ${word2}`
        }
      }
    }

    return { hasConflict: false }
  }
}