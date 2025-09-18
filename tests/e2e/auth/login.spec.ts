import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth-helper';
import { PerformanceHelper } from '../helpers/performance-helper';
import { TEST_USERS } from '../fixtures/test-data';

test.describe('User Login Flow', () => {
  let authHelper: AuthHelper;
  let performanceHelper: PerformanceHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    performanceHelper = new PerformanceHelper(page);
    await performanceHelper.startMeasurement();
  });

  test.afterEach(async () => {
    const report = await performanceHelper.generatePerformanceReport();
    if (report.consoleErrors > 0) {
      console.warn('Console errors detected:', report.consoleErrorDetails);
    }
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    const loadMetrics = await performanceHelper.measurePageLoad('/auth/signin');
    expect(loadMetrics.loadTime).toBeLessThan(3000);

    const user = await authHelper.login('USER1');
    
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toContainText(user.name);
    
    const consoleErrors = await performanceHelper.getConsoleErrors();
    expect(consoleErrors.length).toBe(0);
  });

  test('should handle invalid credentials', async ({ page }) => {
    await page.goto('/auth/signin');
    
    await page.fill('[data-testid="email-input"]', 'invalid@example.com');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');
    
    await expect(page.locator('[data-testid="login-error"]'))
      .toContainText('Invalid credentials');
    
    // Should remain on login page
    await expect(page).toHaveURL(/signin/);
  });

  test('should validate login form fields', async ({ page }) => {
    await page.goto('/auth/signin');
    
    // Test empty form
    await page.click('[data-testid="login-button"]');
    
    await expect(page.locator('[data-testid="email-error"]')).toContainText('Email is required');
    await expect(page.locator('[data-testid="password-error"]')).toContainText('Password is required');
    
    // Test invalid email format
    await page.fill('[data-testid="email-input"]', 'invalid-email');
    await page.blur('[data-testid="email-input"]');
    await expect(page.locator('[data-testid="email-error"]')).toContainText('Invalid email');
  });

  test('should handle password reset flow', async ({ page }) => {
    const email = TEST_USERS.USER1.email;
    
    const resetSent = await authHelper.forgotPassword(email);
    expect(resetSent).toBe(true);
    
    await expect(page.locator('[data-testid="reset-email-sent"]'))
      .toContainText(`Password reset email sent to ${email}`);
  });

  test('should maintain session persistence', async ({ page }) => {
    // Login first
    await authHelper.login('USER1');
    
    // Navigate to another page
    await page.goto('/profile');
    await expect(page.locator('[data-testid="user-profile"]')).toBeVisible();
    
    // Refresh page
    await page.reload();
    
    // Should still be logged in
    await expect(page.locator('[data-testid="user-profile"]')).toBeVisible();
    
    // Navigate directly to protected page
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    await authHelper.login('USER1');
    await authHelper.logout();
    
    // Should be redirected to login
    await expect(page).toHaveURL(/signin/);
    
    // Verify session is cleared by trying to access protected page
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/signin/);
  });

  test('should handle concurrent login attempts', async ({ page, context }) => {
    const user = TEST_USERS.USER1;
    
    // Open second tab
    const secondTab = await context.newPage();
    const secondAuthHelper = new AuthHelper(secondTab);
    
    // Login on both tabs simultaneously
    const [loginResult1, loginResult2] = await Promise.all([
      authHelper.login('USER1'),
      secondAuthHelper.login('USER1')
    ]);
    
    // Both should succeed
    await expect(page).toHaveURL('/dashboard');
    await expect(secondTab).toHaveURL('/dashboard');
    
    // Verify both tabs show logged in state
    await expect(page.locator('[data-testid="user-menu"]')).toContainText(user.name);
    await expect(secondTab.locator('[data-testid="user-menu"]')).toContainText(user.name);
    
    await secondTab.close();
  });

  test('should track login performance metrics', async ({ page }) => {
    await page.goto('/auth/signin');
    
    // Measure form interaction performance
    const emailTypingMetrics = await performanceHelper.measureInteraction(
      '[data-testid="email-input"]',
      'type',
      TEST_USERS.USER1.email
    );
    expect(emailTypingMetrics.duration).toBeLessThan(100);
    
    const passwordTypingMetrics = await performanceHelper.measureInteraction(
      '[data-testid="password-input"]',
      'type',
      TEST_USERS.USER1.password
    );
    expect(passwordTypingMetrics.duration).toBeLessThan(100);
    
    // Measure login button click
    const clickMetrics = await performanceHelper.measureInteraction(
      '[data-testid="login-button"]',
      'click'
    );
    
    // Wait for dashboard load
    await page.waitForURL('/dashboard');
    
    // Check memory usage after login
    const memoryUsage = await performanceHelper.getMemoryUsage();
    if (memoryUsage) {
      expect(memoryUsage.usedJSHeapSize).toBeLessThan(30 * 1024 * 1024); // Less than 30MB
    }
  });

  test('should handle network interruption during login', async ({ page }) => {
    await page.goto('/auth/signin');
    
    await page.fill('[data-testid="email-input"]', TEST_USERS.USER1.email);
    await page.fill('[data-testid="password-input"]', TEST_USERS.USER1.password);
    
    // Simulate network interruption
    await page.context().setOffline(true);
    await page.click('[data-testid="login-button"]');
    
    // Should show network error
    await expect(page.locator('[data-testid="network-error"]'))
      .toBeVisible({ timeout: 5000 });
    
    // Restore network
    await page.context().setOffline(false);
    
    // Retry login
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
    
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('should handle multiple failed login attempts', async ({ page }) => {
    await page.goto('/auth/signin');
    
    const maxAttempts = 5;
    
    for (let i = 0; i < maxAttempts; i++) {
      await page.fill('[data-testid="email-input"]', TEST_USERS.USER1.email);
      await page.fill('[data-testid="password-input"]', 'wrongpassword');
      await page.click('[data-testid="login-button"]');
      
      await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
    }
    
    // After max attempts, should show rate limiting
    await expect(page.locator('[data-testid="rate-limit-error"]'))
      .toContainText('Too many failed attempts');
    
    // Login button should be disabled
    await expect(page.locator('[data-testid="login-button"]')).toBeDisabled();
  });

  test('should detect memory leaks during login process', async ({ page }) => {
    const initialMemory = await performanceHelper.getMemoryUsage();
    
    // Perform multiple login/logout cycles
    for (let i = 0; i < 3; i++) {
      await authHelper.login('USER1');
      await authHelper.logout();
    }
    
    const memoryLeakResult = await performanceHelper.detectMemoryLeaks();
    
    if (memoryLeakResult) {
      expect(memoryLeakResult.hasLeak).toBe(false);
    }
  });

  test('should handle keyboard navigation in login form', async ({ page }) => {
    await page.goto('/auth/signin');
    
    // Tab through form fields
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="email-input"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="password-input"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="login-button"]')).toBeFocused();
    
    // Submit with Enter key
    await page.fill('[data-testid="email-input"]', TEST_USERS.USER1.email);
    await page.fill('[data-testid="password-input"]', TEST_USERS.USER1.password);
    await page.keyboard.press('Enter');
    
    await page.waitForURL('/dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });
});