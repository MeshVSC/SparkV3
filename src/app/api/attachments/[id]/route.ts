import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { unlink } from "fs/promises"
import { join } from "path"

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existingAttachment = await db.attachment.findUnique({
      where: { id: params.id },
    })

    if (!existingAttachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      )
    }

    // Delete file from filesystem if it's not a link
    if (existingAttachment.type !== "LINK") {
      const filepath = join(process.cwd(), "public", existingAttachment.url)
      try {
        await unlink(filepath)
      } catch (error) {
        console.error("Error deleting file:", error)
        // Continue with database deletion even if file deletion fails
      }
    }

    await db.attachment.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting attachment:", error)
    return NextResponse.json(
      { error: "Failed to delete attachment" },
      { status: 500 }
    )
  }
}