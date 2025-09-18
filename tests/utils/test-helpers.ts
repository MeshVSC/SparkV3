import { Page, BrowserContext } from '@playwright/test';
import { TestUser } from '../setup';

export class TestDataFactory {
  static createTestUser(override: Partial<TestUser> = {}): TestUser {
    return {
      id: `user-${Date.now()}`,
      email: `test-${Date.now()}@example.com`,
      password: 'testpass123',
      name: `Test User ${Date.now()}`,
      role: 'user',
      ...override
    };
  }

  static createTestWorkspace(override: any = {}) {
    return {
      id: `workspace-${Date.now()}`,
      name: `Test Workspace ${Date.now()}`,
      description: 'Test workspace description',
      isPublic: false,
      ...override
    };
  }
}

export class PageHelpers {
  static async waitForSocketConnection(page: Page): Promise<void> {
    await page.waitForFunction(() => {
      return (window as any).testSocket?.connected === true;
    }, { timeout: 10000 });
  }

  static async loginUser(page: Page, user: TestUser): Promise<void> {
    await page.goto('/auth/signin');
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  }
}

export class SecurityHelpers {
  static async checkCSPHeaders(page: Page): Promise<Record<string, string>> {
    const response = await page.request.get('/');
    const headers = response.headers();
    return {
      csp: headers['content-security-policy'] || '',
      xFrame: headers['x-frame-options'] || ''
    };
  }

  static async checkSecureCookies(context: BrowserContext): Promise<boolean> {
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(c => c.name.includes('session'));
    return sessionCookie ? sessionCookie.httpOnly && sessionCookie.secure : false;
  }
}

export class CollaborationHelpers {
  static createOperation(override: any = {}) {
    return {
      id: `op-${Date.now()}`,
      type: 'INSERT',
      sparkId: 'test-spark',
      userId: 'test-user',
      clientId: 'test-client',
      position: 0,
      text: 'test text',
      timestamp: Date.now(),
      vectorClock: { 'test-client': 1 },
      ...override
    };
  }

  static async setupCollaborationSession(
    clients: any[], 
    sparkId: string, 
    users: TestUser[]
  ): Promise<void> {
    await Promise.all(clients.map(client => client.connect()));
    await Promise.all(clients.map((client, i) => 
      client.emit('join_collaboration', {
        sparkId, userId: users[i].id, username: users[i].name
      })
    ));
    await Promise.all(clients.map(client => client.waitForEvent('collaboration_state')));
  }
}