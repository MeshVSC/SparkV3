// Test setup and configuration
import { PrismaClient } from '@prisma/client';

declare global {
  var __PRISMA__: PrismaClient | undefined;
}

export const testPrisma = globalThis.__PRISMA__ || new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || 'file:./test.db'
    }
  }
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.__PRISMA__ = testPrisma;
}

export const cleanup = async () => {
  await testPrisma.$disconnect();
};

// Environment validation
export const validateEnvironment = (env: 'development' | 'staging' | 'production') => {
  const requiredVars = {
    development: ['DATABASE_URL', 'NEXTAUTH_SECRET'],
    staging: ['DATABASE_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL'],
    production: ['DATABASE_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL']
  };

  const missing = requiredVars[env].filter(varName => !process.env[varName]);
  return missing.length === 0 ? { valid: true } : { valid: false, missing };
};