import { Page, expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/test-data';

export class AuthHelper {
  constructor(private page: Page) {}

  async login(userKey: keyof typeof TEST_USERS = 'USER1') {
    const user = TEST_USERS[userKey];
    
    await this.page.goto('/auth/signin');
    
    // Fill login form
    await this.page.fill('[data-testid="email-input"]', user.email);
    await this.page.fill('[data-testid="password-input"]', user.password);
    
    // Submit login
    await this.page.click('[data-testid="login-button"]');
    
    // Wait for redirect and verify login
    await this.page.waitForURL('/dashboard');
    await expect(this.page.locator('[data-testid="user-menu"]')).toBeVisible();
    
    return user;
  }

  async register(email: string, password: string, name: string) {
    await this.page.goto('/auth/signup');
    
    // Fill registration form
    await this.page.fill('[data-testid="name-input"]', name);
    await this.page.fill('[data-testid="email-input"]', email);
    await this.page.fill('[data-testid="password-input"]', password);
    await this.page.fill('[data-testid="confirm-password-input"]', password);
    
    // Accept terms
    await this.page.check('[data-testid="terms-checkbox"]');
    
    // Submit registration
    await this.page.click('[data-testid="register-button"]');
    
    // Wait for success or error
    const isSuccess = await this.page.locator('[data-testid="registration-success"]').isVisible({ timeout: 5000 })
      .catch(() => false);
    
    return isSuccess;
  }

  async logout() {
    await this.page.click('[data-testid="user-menu"]');
    await this.page.click('[data-testid="logout-button"]');
    await this.page.waitForURL('/auth/signin');
  }

  async forgotPassword(email: string) {
    await this.page.goto('/auth/signin');
    await this.page.click('[data-testid="forgot-password-link"]');
    await this.page.fill('[data-testid="email-input"]', email);
    await this.page.click('[data-testid="reset-password-button"]');
    
    return await this.page.locator('[data-testid="reset-email-sent"]').isVisible({ timeout: 5000 });
  }

  async isLoggedIn(): Promise<boolean> {
    try {
      await this.page.goto('/dashboard');
      await this.page.locator('[data-testid="user-menu"]').waitFor({ timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  async loginWithSession(userKey: keyof typeof TEST_USERS = 'USER1') {
    // Try to load page directly - if redirected to login, then login
    const user = TEST_USERS[userKey];
    await this.page.goto('/dashboard');
    
    if (this.page.url().includes('/auth/signin')) {
      await this.login(userKey);
    }
    
    return user;
  }
}