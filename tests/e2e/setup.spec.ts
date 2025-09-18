import { test as setup } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

setup('setup test environment', async () => {
  console.log('🔧 Setting up E2E test environment...');
  
  // Reset database
  await resetDatabase();
  
  // Create test data
  await createTestData();
  
  console.log('✅ E2E test environment setup complete');
});

async function resetDatabase() {
  // Clear in proper order to avoid FK constraints
  await prisma.mention.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.connectionHistory.deleteMany();
  await prisma.sparkConnection.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.todo.deleteMany();
  await prisma.spark.deleteMany();
  await prisma.userAchievement.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.userPreferences.deleteMany();
  await prisma.userWorkspace.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.template.deleteMany();
  await prisma.searchHistory.deleteMany();
  await prisma.savedSearch.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
}

async function createTestData() {
  const hashedPassword = await bcrypt.hash('Test123!', 12);
  
  // Create test users
  const user1 = await prisma.user.create({
    data: {
      id: 'test-user-1',
      email: 'test1@playwright.com',
      name: 'Test User One',
      password: hashedPassword,
      emailVerified: true,
      totalXP: 150,
      level: 3,
      currentStreak: 7,
    }
  });

  const user2 = await prisma.user.create({
    data: {
      id: 'test-user-2', 
      email: 'test2@playwright.com',
      name: 'Test User Two',
      password: hashedPassword,
      emailVerified: true,
      totalXP: 75,
      level: 2,
      currentStreak: 3,
    }
  });

  // Create workspaces
  const workspace1 = await prisma.workspace.create({
    data: {
      id: 'test-workspace-1',
      name: 'Primary Test Workspace',
      description: 'Main workspace for E2E testing',
    }
  });

  const workspace2 = await prisma.workspace.create({
    data: {
      id: 'test-workspace-2', 
      name: 'Collaboration Workspace',
      description: 'Shared workspace for collaboration tests',
    }
  });

  // Setup workspace memberships
  await prisma.userWorkspace.createMany({
    data: [
      { userId: user1.id, workspaceId: workspace1.id, role: 'OWNER' },
      { userId: user1.id, workspaceId: workspace2.id, role: 'EDITOR' },
      { userId: user2.id, workspaceId: workspace2.id, role: 'EDITOR' },
    ]
  });

  // Create test sparks with varying statuses
  await prisma.spark.createMany({
    data: [
      {
        id: 'spark-seedling-1',
        userId: user1.id,
        title: 'E2E Test Spark - Seedling',
        description: 'Test spark in seedling stage',
        content: '# Seedling Spark\n\nThis is a test spark for automation.',
        status: 'SEEDLING',
        xp: 15,
        positionX: 100,
        positionY: 150,
        color: '#10b981',
        tags: JSON.stringify(['e2e', 'testing', 'seedling']),
      },
      {
        id: 'spark-sapling-1',
        userId: user1.id,
        title: 'E2E Test Spark - Sapling',
        description: 'Test spark in sapling stage',
        content: '# Sapling Spark\n\nThis spark has grown to sapling stage.',
        status: 'SAPLING',
        xp: 45,
        positionX: 300,
        positionY: 200,
        color: '#3b82f6',
        tags: JSON.stringify(['e2e', 'testing', 'sapling']),
      },
      {
        id: 'spark-tree-1',
        userId: user1.id,
        title: 'E2E Test Spark - Tree',
        description: 'Test spark in tree stage',
        content: '# Tree Spark\n\nThis spark has matured to tree stage.',
        status: 'TREE',
        xp: 120,
        positionX: 500,
        positionY: 250,
        color: '#8b5cf6',
        tags: JSON.stringify(['e2e', 'testing', 'tree']),
      },
      {
        id: 'spark-shared-1',
        userId: user2.id,
        title: 'Shared Collaboration Spark',
        description: 'Spark for collaboration testing',
        content: '# Collaboration Spark\n\nThis spark is used for testing collaboration features.',
        status: 'SAPLING',
        xp: 35,
        positionX: 150,
        positionY: 300,
        color: '#ef4444',
        tags: JSON.stringify(['collaboration', 'shared', 'testing']),
      },
    ]
  });

  // Create todos for bulk operations testing
  await prisma.todo.createMany({
    data: [
      {
        id: 'todo-high-1',
        sparkId: 'spark-seedling-1',
        title: 'High Priority Todo 1',
        description: 'Critical task for testing',
        completed: false,
        type: 'TASK',
        priority: 'HIGH',
      },
      {
        id: 'todo-high-2', 
        sparkId: 'spark-seedling-1',
        title: 'High Priority Todo 2',
        description: 'Another critical task',
        completed: false,
        type: 'TASK',
        priority: 'HIGH',
      },
      {
        id: 'todo-medium-1',
        sparkId: 'spark-sapling-1',
        title: 'Medium Priority Todo',
        description: 'Medium importance task',
        completed: true,
        type: 'GENERAL',
        priority: 'MEDIUM',
      },
      {
        id: 'todo-low-1',
        sparkId: 'spark-tree-1', 
        title: 'Low Priority Todo',
        description: 'Low importance task',
        completed: false,
        type: 'GENERAL',
        priority: 'LOW',
      },
    ]
  });

  // Create user preferences
  await prisma.userPreferences.createMany({
    data: [
      {
        userId: user1.id,
        theme: 'DARK',
        soundEnabled: true,
        defaultSparkColor: '#10b981',
        viewMode: 'CANVAS',
      },
      {
        userId: user2.id,
        theme: 'LIGHT', 
        soundEnabled: false,
        defaultSparkColor: '#3b82f6',
        viewMode: 'KANBAN',
      },
    ]
  });

  // Create spark connections for testing
  await prisma.sparkConnection.createMany({
    data: [
      {
        sparkId1: 'spark-seedling-1',
        sparkId2: 'spark-sapling-1',
        type: 'DEPENDS_ON',
      },
      {
        sparkId1: 'spark-sapling-1',
        sparkId2: 'spark-tree-1',
        type: 'RELATED_TO',
      },
    ]
  });

  await prisma.$disconnect();
}