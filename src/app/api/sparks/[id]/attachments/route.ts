import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { writeFile } from "fs/promises"
import { join } from "path"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const attachments = await db.attachment.findMany({
      where: { sparkId: params.id },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json(attachments)
  } catch (error) {
    console.error("Error fetching attachments:", error)
    return NextResponse.json(
      { error: "Failed to fetch attachments" },
      { status: 500 }
    )
  }
}

export async function POST(
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

    const formData = await request.formData()
    const file = formData.get("file") as File
    const type = formData.get("type") as string || "FILE"
    const url = formData.get("url") as string

    let attachmentData: any = {
      sparkId: params.id,
      type: type,
    }

    if (file && file instanceof File) {
      // Handle file upload
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      // Create uploads directory if it doesn't exist
      const uploadDir = join(process.cwd(), "public", "uploads")
      const filename = `${Date.now()}-${file.name}`
      const filepath = join(uploadDir, filename)

      await writeFile(filepath, buffer)

      attachmentData = {
        ...attachmentData,
        filename: file.name,
        url: `/uploads/${filename}`,
        size: file.size,
      }
    } else if (url) {
      // Handle URL/Link attachment
      attachmentData = {
        ...attachmentData,
        filename: url,
        url: url,
        type: "LINK",
      }
    } else {
      return NextResponse.json(
        { error: "No file or URL provided" },
        { status: 400 }
      )
    }

    const attachment = await db.attachment.create({
      data: attachmentData,
    })

    return NextResponse.json(attachment, { status: 201 })
  } catch (error) {
    console.error("Error creating attachment:", error)
    return NextResponse.json(
      { error: "Failed to create attachment" },
      { status: 500 }
    )
  }
}