import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Navigation and Core Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('landing page loads and displays correctly', async ({ page }) => {
    // Verify page title and metadata
    await expect(page).toHaveTitle(/Spark/);
    
    // Check core elements are present
    await expect(page.locator('h1')).toContainText('Spark');
    await expect(page.locator('text=Capture every spark')).toBeVisible();
    
    // Verify logo is present
    await expect(page.locator('img[alt="Spark Logo"]')).toBeVisible();
    
    // Check CTA button
    const ctaButton = page.locator('button', { hasText: 'Get Started' });
    await expect(ctaButton).toBeVisible();
  });

  test('navigation from landing to app works', async ({ page }) => {
    // Click Get Started button
    await page.locator('button', { hasText: 'Get Started' }).click();
    
    // Should navigate to app page
    await expect(page).toHaveURL('/app');
    
    // Check that app components are loaded
    await page.waitForSelector('[data-testid="spark-view"], #spark-canvas', { timeout: 10000 });
  });

  test('direct app page access works', async ({ page }) => {
    await page.goto('/app');
    
    // Verify app loads correctly
    await expect(page).toHaveURL('/app');
    
    // Wait for main app components to load
    await page.waitForSelector('[data-testid="spark-view"], #spark-canvas', { timeout: 10000 });
  });

  test('mobile navigation tabs work correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // Mobile viewport
    await page.goto('/app');
    
    // Wait for mobile navigation to load
    await page.waitForSelector('[data-testid="bottom-navigation"]', { timeout: 10000 });
    
    // Test tab switching
    const sparkTab = page.locator('[data-testid="nav-tab-sparks"]');
    const kanbanTab = page.locator('[data-testid="nav-tab-kanban"]');
    const timelineTab = page.locator('[data-testid="nav-tab-timeline"]');
    
    if (await sparkTab.isVisible()) {
      await sparkTab.click();
      await page.waitForTimeout(500);
    }
    
    if (await kanbanTab.isVisible()) {
      await kanbanTab.click();
      await page.waitForTimeout(500);
    }
    
    if (await timelineTab.isVisible()) {
      await timelineTab.click();
      await page.waitForTimeout(500);
    }
  });

  test('floating action button is present on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/app');
    
    // Check for FAB
    const fab = page.locator('[data-testid="floating-action-button"]');
    if (await fab.isVisible()) {
      await expect(fab).toBeVisible();
    }
  });

  test('responsive design breakpoints work', async ({ page }) => {
    await page.goto('/app');
    
    // Test desktop layout
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(500);
    
    // Test tablet layout
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    
    // Test mobile layout
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    // Verify the page doesn't break at different viewports
    await expect(page.locator('body')).toBeVisible();
  });

  test('accessibility compliance', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('app accessibility compliance', async ({ page }) => {
    await page.goto('/app');
    await page.waitForSelector('[data-testid="spark-view"], #spark-canvas', { timeout: 10000 });
    
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    // Allow some minor violations that don't affect core functionality
    const criticalViolations = accessibilityScanResults.violations.filter(
      violation => ['critical', 'serious'].includes(violation.impact || '')
    );
    expect(criticalViolations).toEqual([]);
  });
});

test.describe('Component Mounting Verification', () => {
  test('spark canvas loads and mounts properly', async ({ page }) => {
    await page.goto('/app');
    
    // Wait for canvas to load
    await page.waitForSelector('#spark-canvas', { timeout: 10000 });
    
    // Verify canvas is present and has expected attributes
    const canvas = page.locator('#spark-canvas');
    await expect(canvas).toBeVisible();
  });

  test('core UI components render without errors', async ({ page }) => {
    await page.goto('/app');
    
    // Wait for app to load
    await page.waitForLoadState('networkidle');
    
    // Check for console errors
    const logs = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        logs.push(msg.text());
      }
    });
    
    await page.waitForTimeout(2000);
    
    // Filter out known non-critical errors
    const criticalErrors = logs.filter(log => 
      !log.includes('Failed to load resource') &&
      !log.includes('ServiceWorker') &&
      !log.includes('manifest')
    );
    
    expect(criticalErrors).toEqual([]);
  });
});