import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { z } from "zod"

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(6),
})

export async function POST(req: NextRequest) {
  try {
    console.log("Registration attempt started")
    const body = await req.json()
    console.log("Request body received:", { email: body.email, name: body.name, hasPassword: !!body.password })
    
    const { email, name, password } = registerSchema.parse(body)
    console.log("Zod validation passed")

    // Check if user already exists
    console.log("Checking for existing user...")
    const existingUser = await db.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      console.log("User already exists")
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      )
    }

    console.log("No existing user found, proceeding with creation")
    
    // Hash password
    console.log("Hashing password...")
    const hashedPassword = await bcrypt.hash(password, 12)
    console.log("Password hashed successfully")

    // Create user
    console.log("Creating user in database...")
    const user = await db.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        preferences: {
          create: {
            theme: "AUTO",
            pushNotifications: true,
            soundEnabled: true,
            defaultSparkColor: "#10b981",
            viewMode: "CANVAS",
          },
        },
      },
      include: {
        preferences: true,
      },
    })
    console.log("User created successfully")

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user

    return NextResponse.json(
      {
        message: "User created successfully",
        user: userWithoutPassword,
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Zod validation error:", error.issues)
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      )
    }

    console.error("Registration error:", error)
    console.error("Error stack:", error.stack)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}