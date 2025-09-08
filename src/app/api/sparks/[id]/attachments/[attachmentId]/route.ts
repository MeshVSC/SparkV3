import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { unlink } from "fs/promises"
import { join } from "path"

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; attachmentId: string } }
) {
  try {
    const attachment = await db.attachment.findFirst({
      where: { 
        id: params.attachmentId,
        sparkId: params.id,
      },
    })

    if (!attachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      )
    }

    // Delete file from filesystem
    try {
      const filepath = join(process.cwd(), "public", attachment.url)
      await unlink(filepath)
    } catch (error) {
      console.error("Error deleting file:", error)
      // Don't fail the request if file deletion fails
    }

    // Delete attachment record
    await db.attachment.delete({
      where: { id: params.attachmentId },
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