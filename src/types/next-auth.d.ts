import { DefaultSession, DefaultUser } from "next-auth"
import { UserPreferences } from "@prisma/client"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      totalXP: number
      level: number
      currentStreak: number
      preferences?: UserPreferences
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    totalXP: number
    level: number
    currentStreak: number
    preferences?: UserPreferences
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    totalXP: number
    level: number
    currentStreak: number
    preferences?: UserPreferences
  }
}