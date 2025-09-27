import crypto from "crypto"
import { addMinutes } from "date-fns"

import { db } from "@/lib/db"

export const RESET_TOKEN_EXPIRATION_MINUTES = 30

export async function createPasswordResetToken(userId: string) {
  const rawToken = crypto.randomBytes(32).toString("hex")
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")
  const expiresAt = addMinutes(new Date(), RESET_TOKEN_EXPIRATION_MINUTES)

  await db.passwordResetToken.deleteMany({
    where: {
      userId,
      usedAt: null,
    },
  })

  const record = await db.passwordResetToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  })

  return { token: rawToken, expiresAt, tokenId: record.id }
}

export async function findValidPasswordResetToken(token: string) {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

  return db.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: true,
    },
  })
}

export async function markPasswordResetTokenUsed(id: string) {
  await db.passwordResetToken.update({
    where: { id },
    data: { usedAt: new Date() },
  })
}
