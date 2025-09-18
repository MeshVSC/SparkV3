import { PrismaClient } from '@prisma/client'

// Test database utilities
export async function createTestDatabase() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.NODE_ENV === 'test' 
          ? process.env.CI_DATABASE_URL || 'file:./test.db'
          : process.env.DATABASE_URL
      }
    }
  })

  return prisma
}

export async function cleanupTestDatabase(prisma: PrismaClient) {
  // Clean up in reverse dependency order
  await prisma.userAchievement.deleteMany()
  await prisma.achievement.deleteMany()
  await prisma.connectionHistory.deleteMany()
  await prisma.sparkConnection.deleteMany()
  await prisma.attachment.deleteMany()
  await prisma.todo.deleteMany()
  await prisma.spark.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.mention.deleteMany()
  await prisma.comment.deleteMany()
  await prisma.userPreferences.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.userWorkspace.deleteMany()
  await prisma.workspace.deleteMany()
  await prisma.template.deleteMany()
  await prisma.searchHistory.deleteMany()
  await prisma.savedSearch.deleteMany()
  await prisma.tag.deleteMany()
  await prisma.user.deleteMany()
  
  await prisma.$disconnect()
}

export async function seedTestDatabase(prisma: PrismaClient) {
  // Create test user
  const testUser = await prisma.user.create({
    data: {
      id: 'test-user-1',
      email: 'test@example.com',
      name: 'Test User',
      totalXP: 100,
      level: 1,
      currentStreak: 5,
      emailVerified: true,
    }
  })

  // Create test sparks
  const testSpark = await prisma.spark.create({
    data: {
      id: 'test-spark-1',
      userId: testUser.id,
      title: 'Test Spark',
      description: 'A test spark for integration testing',
      content: '# Test Content',
      status: 'SEEDLING',
      xp: 10,
      level: 1,
      color: '#10b981',
      tags: '["test", "integration"]',
    }
  })

  // Create test todos
  await prisma.todo.create({
    data: {
      id: 'test-todo-1',
      sparkId: testSpark.id,
      title: 'Test Todo',
      description: 'A test todo item',
      completed: false,
      type: 'GENERAL',
      priority: 'MEDIUM',
    }
  })

  return { testUser, testSpark }
}