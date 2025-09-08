import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")

    if (!query || query.trim() === "") {
      const sparks = await db.spark.findMany({
        include: {
          todos: true,
          attachments: true,
          connections: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
      })
      return NextResponse.json(sparks)
    }

    const searchQuery = query.trim().toLowerCase()
    
    const sparks = await db.spark.findMany({
      where: {
        OR: [
          {
            title: {
              contains: searchQuery,
              mode: "insensitive",
            },
          },
          {
            description: {
              contains: searchQuery,
              mode: "insensitive",
            },
          },
          {
            content: {
              contains: searchQuery,
              mode: "insensitive",
            },
          },
          {
            tags: {
              contains: searchQuery,
              mode: "insensitive",
            },
          },
        ],
      },
      include: {
        todos: true,
        attachments: true,
        connections: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    })

    return NextResponse.json(sparks)
  } catch (error) {
    console.error("Error searching sparks:", error)
    return NextResponse.json(
      { error: "Failed to search sparks" },
      { status: 500 }
    )
  }
}