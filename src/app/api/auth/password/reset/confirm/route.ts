import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"

import { db } from "@/lib/db"
import { findValidPasswordResetToken, markPasswordResetTokenUsed } from "@/lib/password-reset"

const confirmSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, password } = confirmSchema.parse(body)

    const tokenRecord = await findValidPasswordResetToken(token)

    if (!tokenRecord || !tokenRecord.user) {
      return NextResponse.json({ error: "Invalid or expired reset token" }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    await db.user.update({
      where: { id: tokenRecord.userId },
      data: {
        password: hashedPassword,
        emailVerified: true,
      },
    })

    await markPasswordResetTokenUsed(tokenRecord.id)

    return NextResponse.json({ message: "Password updated successfully" })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }

    console.error("Password reset confirmation failed", error)
    return NextResponse.json({ error: "Unable to update password" }, { status: 500 })
  }
}
