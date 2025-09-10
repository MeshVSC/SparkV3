import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as any,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await db.user.findUnique({
          where: {
            email: credentials.email,
          },
          include: {
            preferences: true,
          },
        })

        if (!user || !user.password) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        // Update last login
        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar,
          totalXP: user.totalXP,
          level: user.level,
          currentStreak: user.currentStreak,
          preferences: user.preferences ?? undefined,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const dbUserFull = await db.user.findUnique({
          where: { email: user.email as string },
          include: { preferences: true },
        })
        if (dbUserFull) {
          token.id = dbUserFull.id
          token.totalXP = dbUserFull.totalXP
          token.level = dbUserFull.level
          token.currentStreak = dbUserFull.currentStreak
          token.preferences = dbUserFull.preferences ?? undefined
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.totalXP = token.totalXP as number
        session.user.level = token.level as number
        session.user.currentStreak = token.currentStreak as number
        session.user.preferences = token.preferences as any
      }
      return session
    },
  },
}
