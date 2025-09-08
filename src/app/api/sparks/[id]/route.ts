import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const spark = await db.spark.findUnique({
      where: { id: params.id },
      include: {
        todos: true,
        attachments: true,
        connections: true,
      },
    })

    if (!spark) {
      return NextResponse.json(
        { error: "Spark not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(spark)
  } catch (error) {
    console.error("Error fetching spark:", error)
    return NextResponse.json(
      { error: "Failed to fetch spark" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    
    const existingSpark = await db.spark.findUnique({
      where: { id: params.id },
    })

    if (!existingSpark) {
      return NextResponse.json(
        { error: "Spark not found" },
        { status: 404 }
      )
    }

    const spark = await db.spark.update({
      where: { id: params.id },
      data: {
        title: body.title,
        description: body.description,
        content: body.content,
        status: body.status,
        xp: body.xp,
        level: body.level,
        positionX: body.positionX,
        positionY: body.positionY,
        color: body.color,
        tags: body.tags,
      },
      include: {
        todos: true,
        attachments: true,
        connections: true,
      },
    })

    return NextResponse.json(spark)
  } catch (error) {
    console.error("Error updating spark:", error)
    return NextResponse.json(
      { error: "Failed to update spark" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existingSpark = await db.spark.findUnique({
      where: { id: params.id },
    })

    if (!existingSpark) {
      return NextResponse.json(
        { error: "Spark not found" },
        { status: 404 }
      )
    }

    await db.spark.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting spark:", error)
    return NextResponse.json(
      { error: "Failed to delete spark" },
      { status: 500 }
    )
  }
}