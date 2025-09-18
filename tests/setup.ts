// Test setup and configuration
import { test as base, expect, Page } from '@playwright/test';
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

export interface TestUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'user' | 'viewer';
}

export class SocketTestClient {
  private connected = false;

  constructor(private page: Page, private userId: string) {}

  async connect(): Promise<void> {
    await this.page.evaluate(
      ([userId]) => {
        return new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = '/socket.io/socket.io.js';
          script.onload = () => {
            const socket = (window as any).io('/api/socketio', { query: { userId } });
            socket.on('connect', () => {
              (window as any).testSocket = socket;
              resolve();
            });
            socket.on('connect_error', reject);
          };
          document.head.appendChild(script);
        });
      },
      [this.userId]
    );
    this.connected = true;
  }

  async emit(event: string, data: any): Promise<void> {
    await this.page.evaluate(
      ([event, data]) => (window as any).testSocket?.emit(event, data),
      [event, data]
    );
  }

  async waitForEvent(event: string, timeout = 5000): Promise<any> {
    return this.page.evaluate(
      ([event, timeout]) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeout);
          (window as any).testSocket?.once(event, (data: any) => {
            clearTimeout(timer);
            resolve(data);
          });
        });
      },
      [event, timeout]
    );
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.page.evaluate(() => {
        (window as any).testSocket?.disconnect();
        delete (window as any).testSocket;
      });
      this.connected = false;
    }
  }
}

export const test = base.extend<{
  authenticatedPage: Page;
  socketClient: SocketTestClient;
  testUsers: TestUser[];
}>({
  testUsers: async ({}, use) => {
    const users: TestUser[] = [
      { id: '1', email: 'admin@test.com', password: 'admin123', name: 'Admin User', role: 'admin' },
      { id: '2', email: 'user@test.com', password: 'user123', name: 'Test User', role: 'user' },
      { id: '3', email: 'viewer@test.com', password: 'viewer123', name: 'Viewer User', role: 'viewer' }
    ];
    await use(users);
  },

  authenticatedPage: async ({ page, testUsers }, use) => {
    await page.goto('/auth/signin');
    await page.fill('input[name="email"]', testUsers[0].email);
    await page.fill('input[name="password"]', testUsers[0].password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await use(page);
  },

  socketClient: async ({ page, testUsers }, use) => {
    const client = new SocketTestClient(page, testUsers[0].id);
    await client.connect();
    await use(client);
    await client.disconnect();
  }
});

export { expect } from '@playwright/test';
