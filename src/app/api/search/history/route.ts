import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const limit = parseInt(searchParams.get("limit") || "50")

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      )
    }

    const searchHistory = await db.searchHistory.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        createdAt: "desc"
      },
      take: Math.min(limit, 100) // Cap at 100 items
    })

    return NextResponse.json(searchHistory)
  } catch (error) {
    console.error("Error fetching search history:", error)
    return NextResponse.json(
      { error: "Failed to fetch search history" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, query, filters, resultCount } = body

    if (!userId || !query || query.trim().length === 0) {
      return NextResponse.json(
        { error: "User ID and query are required" },
        { status: 400 }
      )
    }

    // Check if the same query was searched recently (within last 5 minutes) to avoid duplicates
    const recentThreshold = new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
    const recentSearch = await db.searchHistory.findFirst({
      where: {
        userId,
        query: query.trim(),
        createdAt: {
          gte: recentThreshold
        }
      }
    })

    if (recentSearch) {
      // Update the existing recent search instead of creating a new one
      const updatedSearch = await db.searchHistory.update({
        where: { id: recentSearch.id },
        data: {
          resultCount: resultCount || recentSearch.resultCount,
          filters: filters || recentSearch.filters,
          createdAt: new Date() // Update timestamp
        }
      })
      return NextResponse.json(updatedSearch)
    }

    // Create new search history entry
    const searchHistoryEntry = await db.searchHistory.create({
      data: {
        userId,
        query: query.trim(),
        filters: filters || null,
        resultCount: resultCount || null,
      },
    })

    // Clean up old entries (keep only last 100 per user)
    const userHistoryCount = await db.searchHistory.count({
      where: { userId }
    })

    if (userHistoryCount > 100) {
      const oldEntries = await db.searchHistory.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        take: userHistoryCount - 100
      })

      if (oldEntries.length > 0) {
        await db.searchHistory.deleteMany({
          where: {
            id: {
              in: oldEntries.map(entry => entry.id)
            }
          }
        })
      }
    }

    return NextResponse.json(searchHistoryEntry)
  } catch (error) {
    console.error("Error creating search history entry:", error)
    return NextResponse.json(
      { error: "Failed to create search history entry" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const id = searchParams.get("id")

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      )
    }

    if (id) {
      // Delete specific search history entry
      const entry = await db.searchHistory.findFirst({
        where: { id, userId }
      })

      if (!entry) {
        return NextResponse.json(
          { error: "Search history entry not found" },
          { status: 404 }
        )
      }

      await db.searchHistory.delete({
        where: { id }
      })
    } else {
      // Clear all search history for user
      await db.searchHistory.deleteMany({
        where: { userId }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting search history:", error)
    return NextResponse.json(
      { error: "Failed to delete search history" },
      { status: 500 }
    )
  }
}