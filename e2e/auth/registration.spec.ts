import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth-helper';
import { PerformanceHelper } from '../helpers/performance-helper';

test.describe('User Registration Flow', () => {
  let authHelper: AuthHelper;
  let performanceHelper: PerformanceHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    performanceHelper = new PerformanceHelper(page);
    await performanceHelper.startMeasurement();
  });

  test.afterEach(async () => {
    const report = await performanceHelper.generatePerformanceReport();
    console.log('Performance Report:', report);
  });

  test('should register new user successfully', async ({ page }) => {
    const email = `newuser-${Date.now()}@test.com`;
    const password = 'NewUser123!';
    const name = 'New Test User';

    // Measure registration page load
    const loadMetrics = await performanceHelper.measurePageLoad('/auth/signup');
    expect(loadMetrics.loadTime).toBeLessThan(3000);

    // Test registration
    const success = await authHelper.register(email, password, name);
    expect(success).toBe(true);

    // Verify user is redirected to dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Check for console errors
    const consoleErrors = await performanceHelper.getConsoleErrors();
    expect(consoleErrors.length).toBe(0);
  });

  test('should validate registration form fields', async ({ page }) => {
    await page.goto('/auth/signup');

    // Test empty form submission
    await page.click('[data-testid="register-button"]');
    
    await expect(page.locator('[data-testid="name-error"]')).toContainText('Name is required');
    await expect(page.locator('[data-testid="email-error"]')).toContainText('Email is required');
    await expect(page.locator('[data-testid="password-error"]')).toContainText('Password is required');

    // Test invalid email
    await page.fill('[data-testid="email-input"]', 'invalid-email');
    await page.blur('[data-testid="email-input"]');
    await expect(page.locator('[data-testid="email-error"]')).toContainText('Invalid email');

    // Test weak password
    await page.fill('[data-testid="password-input"]', '123');
    await page.blur('[data-testid="password-input"]');
    await expect(page.locator('[data-testid="password-error"]')).toContainText('Password must be at least 8 characters');

    // Test password confirmation mismatch
    await page.fill('[data-testid="password-input"]', 'StrongPass123!');
    await page.fill('[data-testid="confirm-password-input"]', 'DifferentPass123!');
    await page.blur('[data-testid="confirm-password-input"]');
    await expect(page.locator('[data-testid="confirm-password-error"]')).toContainText('Passwords do not match');
  });

  test('should handle duplicate email registration', async ({ page }) => {
    const email = 'test1@playwright.com'; // Existing user from setup
    const password = 'NewUser123!';
    const name = 'Duplicate User';

    const success = await authHelper.register(email, password, name);
    expect(success).toBe(false);

    await expect(page.locator('[data-testid="registration-error"]'))
      .toContainText('User with this email already exists');
  });

  test('should require terms acceptance', async ({ page }) => {
    await page.goto('/auth/signup');

    await page.fill('[data-testid="name-input"]', 'Test User');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'TestPass123!');
    await page.fill('[data-testid="confirm-password-input"]', 'TestPass123!');
    
    // Try to submit without accepting terms
    await page.click('[data-testid="register-button"]');
    
    await expect(page.locator('[data-testid="terms-error"]'))
      .toContainText('You must accept the terms and conditions');
  });

  test('should track registration performance metrics', async ({ page }) => {
    const email = `perf-test-${Date.now()}@test.com`;
    const password = 'PerfTest123!';
    const name = 'Performance Test User';

    // Measure form interaction performance
    const nameTypingMetrics = await performanceHelper.measureInteraction(
      '[data-testid="name-input"]', 
      'type', 
      name
    );
    expect(nameTypingMetrics.duration).toBeLessThan(100);

    const emailTypingMetrics = await performanceHelper.measureInteraction(
      '[data-testid="email-input"]', 
      'type', 
      email
    );
    expect(emailTypingMetrics.duration).toBeLessThan(100);

    // Test registration submission performance
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.check('[data-testid="terms-checkbox"]');

    const submitMetrics = await performanceHelper.measureInteraction(
      '[data-testid="register-button"]', 
      'click'
    );

    // Wait for registration to complete
    await page.waitForURL('/dashboard', { timeout: 10000 });
    
    // Check memory usage
    const memoryUsage = await performanceHelper.getMemoryUsage();
    if (memoryUsage) {
      expect(memoryUsage.usedJSHeapSize).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
    }
  });

  test('should handle network interruption during registration', async ({ page }) => {
    const email = `network-test-${Date.now()}@test.com`;
    const password = 'NetworkTest123!';
    const name = 'Network Test User';

    await page.goto('/auth/signup');
    await page.fill('[data-testid="name-input"]', name);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.check('[data-testid="terms-checkbox"]');

    // Simulate network interruption
    await page.context().setOffline(true);
    await page.click('[data-testid="register-button"]');

    // Should show network error
    await expect(page.locator('[data-testid="network-error"]'))
      .toBeVisible({ timeout: 5000 });

    // Restore network
    await page.context().setOffline(false);

    // Retry registration
    await page.click('[data-testid="register-button"]');
    await page.waitForURL('/dashboard', { timeout: 10000 });
    
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('should detect infinite loops during registration', async ({ page }) => {
    await page.goto('/auth/signup');
    
    // Check for infinite loops
    const hasInfiniteLoop = await performanceHelper.checkForInfiniteLoops(3000);
    expect(hasInfiniteLoop).toBe(false);
  });
});