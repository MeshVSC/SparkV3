import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { db } from "@/lib/db"
import { createPasswordResetToken, RESET_TOKEN_EXPIRATION_MINUTES } from "@/lib/password-reset"
import { emailService } from "@/lib/email/EmailService"
import "@/lib/email/EmailServiceIntegration"

const requestSchema = z.object({
  email: z.string().email(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email } = requestSchema.parse(body)

    const normalizedEmail = email.toLowerCase()
    const user = await db.user.findUnique({ where: { email: normalizedEmail } })

    if (user && user.password) {
      try {
        const { token, expiresAt } = await createPasswordResetToken(user.id)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000"
        const resetUrl = `${baseUrl.replace(/\/$/, "")}/auth/reset-password?token=${token}`

        await emailService.sendEmail(
          user.email,
          "Reset your Spark password",
          "password_reset",
          {
            name: user.name ?? user.email,
            resetUrl,
            expiresAt: expiresAt.toISOString(),
            expiresInMinutes: RESET_TOKEN_EXPIRATION_MINUTES,
            supportEmail: process.env.SUPPORT_EMAIL ?? "support@spark.app",
            appName: "Spark",
          },
          { priority: "high" as any }
        )
      } catch (error) {
        console.error("Failed to queue password reset email", error)
      }
    }

    return NextResponse.json({
      message: "If an account with that email exists, you'll receive reset instructions shortly.",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
    }

    console.error("Password reset request failed", error)
    return NextResponse.json({ error: "Unable to process request" }, { status: 500 })
  }
}
