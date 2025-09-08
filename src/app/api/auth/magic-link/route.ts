import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { z } from "zod"
import crypto from "crypto"

const magicLinkSchema = z.object({
  email: z.string().email(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email } = magicLinkSchema.parse(body)

    // Check if user exists
    const user = await db.user.findUnique({
      where: { email },
    })

    if (!user) {
      // For security, don't reveal if user doesn't exist
      return NextResponse.json(
        { message: "If an account exists, you will receive a magic link" },
        { status: 200 }
      )
    }

    // Generate magic link token
    const token = crypto.randomBytes(32).toString("hex")
    const expires = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

    // Store token (in a real app, you'd use a separate table for magic link tokens)
    // For now, we'll use the session table
    await db.session.create({
      data: {
        sessionToken: token,
        userId: user.id,
        expires,
      },
    })

    // In a real app, you would send an email with the magic link
    // For demo purposes, we'll just return the token
    const magicLink = `${process.env.NEXTAUTH_URL}/auth/magic-link?token=${token}`

    console.log("Magic link:", magicLink) // For development

    return NextResponse.json(
      { message: "Magic link sent successfully" },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      )
    }

    console.error("Magic link error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}