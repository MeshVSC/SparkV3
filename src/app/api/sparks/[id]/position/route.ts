import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { x, y } = body
    
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
        positionX: x,
        positionY: y,
      },
      include: {
        todos: true,
        attachments: true,
        connections: true,
      },
    })

    return NextResponse.json(spark)
  } catch (error) {
    console.error("Error updating spark position:", error)
    return NextResponse.json(
      { error: "Failed to update spark position" },
      { status: 500 }
    )
  }
}