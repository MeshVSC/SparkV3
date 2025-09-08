import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      )
    }

    const savedSearches = await db.savedSearch.findMany({
      where: {
        userId: userId,
      },
      orderBy: [
        { lastUsedAt: "desc" },
        { updatedAt: "desc" }
      ]
    })

    return NextResponse.json(savedSearches)
  } catch (error) {
    console.error("Error fetching saved searches:", error)
    return NextResponse.json(
      { error: "Failed to fetch saved searches" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, name, description, query, filters, tags, isPublic } = body

    if (!userId || !name || !query) {
      return NextResponse.json(
        { error: "User ID, name, and query are required" },
        { status: 400 }
      )
    }

    const savedSearch = await db.savedSearch.create({
      data: {
        userId,
        name,
        description,
        query,
        filters: filters || null,
        tags: tags ? (Array.isArray(tags) ? tags.join(',') : tags) : null,
        isPublic: isPublic || false,
      },
    })

    return NextResponse.json(savedSearch)
  } catch (error) {
    console.error("Error creating saved search:", error)
    return NextResponse.json(
      { error: "Failed to create saved search" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, userId, name, description, query, filters, tags, isPublic } = body

    if (!id || !userId) {
      return NextResponse.json(
        { error: "ID and User ID are required" },
        { status: 400 }
      )
    }

    // Verify ownership
    const existingSearch = await db.savedSearch.findFirst({
      where: {
        id,
        userId,
      },
    })

    if (!existingSearch) {
      return NextResponse.json(
        { error: "Saved search not found or access denied" },
        { status: 404 }
      )
    }

    const updatedSearch = await db.savedSearch.update({
      where: { id },
      data: {
        name: name || existingSearch.name,
        description: description !== undefined ? description : existingSearch.description,
        query: query || existingSearch.query,
        filters: filters !== undefined ? filters : existingSearch.filters,
        tags: tags !== undefined ? (Array.isArray(tags) ? tags.join(',') : tags) : existingSearch.tags,
        isPublic: isPublic !== undefined ? isPublic : existingSearch.isPublic,
      },
    })

    return NextResponse.json(updatedSearch)
  } catch (error) {
    console.error("Error updating saved search:", error)
    return NextResponse.json(
      { error: "Failed to update saved search" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const userId = searchParams.get("userId")

    if (!id || !userId) {
      return NextResponse.json(
        { error: "ID and User ID are required" },
        { status: 400 }
      )
    }

    // Verify ownership
    const existingSearch = await db.savedSearch.findFirst({
      where: {
        id,
        userId,
      },
    })

    if (!existingSearch) {
      return NextResponse.json(
        { error: "Saved search not found or access denied" },
        { status: 404 }
      )
    }

    await db.savedSearch.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting saved search:", error)
    return NextResponse.json(
      { error: "Failed to delete saved search" },
      { status: 500 }
    )
  }
}