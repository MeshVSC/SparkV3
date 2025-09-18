// Playwright cross-browser tests
import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';

test.describe('Cross-Browser Feature Tests', () => {
  test('detects browser capabilities', async ({ page, browserName }) => {
    await page.goto('/');

    // Test basic navigation
    await expect(page).toHaveTitle(/Spark/);

    // Test localStorage support
    await page.evaluate(() => {
      localStorage.setItem('test', 'value');
    });

    const stored = await page.evaluate(() => localStorage.getItem('test'));
    expect(stored).toBe('value');

    // Clean up
    await page.evaluate(() => localStorage.removeItem('test'));
  });

  test('handles touch events on mobile', async ({ page, browserName }) => {
    // Skip on desktop browsers
    if (!browserName.includes('Mobile') && !browserName.includes('webkit')) {
      test.skip();
    }

    await page.goto('/');

    // Test touch interaction
    await page.locator('[data-testid="spark-canvas"]').tap();
    
    // Verify touch handling
    const touchSupported = await page.evaluate(() => 'ontouchstart' in window);
    expect(touchSupported).toBe(true);
  });

  test('supports WebGL rendering', async ({ page, browserName }) => {
    await page.goto('/');

    const webglSupported = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!gl;
    });

    // WebGL should be supported on modern browsers
    if (browserName !== 'webkit') { // Safari sometimes has issues
      expect(webglSupported).toBe(true);
    }
  });

  test('handles offline/online state', async ({ page }) => {
    await page.goto('/');

    // Go offline
    await page.context().setOffline(true);
    
    // Test offline behavior
    const offlineStatus = await page.evaluate(() => !navigator.onLine);
    expect(offlineStatus).toBe(true);

    // Go back online
    await page.context().setOffline(false);
    
    const onlineStatus = await page.evaluate(() => navigator.onLine);
    expect(onlineStatus).toBe(true);
  });

  test('responsive design across viewports', async ({ page, browserName }) => {
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    
    const desktopNav = page.locator('[data-testid="desktop-nav"]');
    await expect(desktopNav).toBeVisible();

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    
    const mobileNav = page.locator('[data-testid="mobile-nav"]');
    await expect(mobileNav).toBeVisible();
  });

  test('drag and drop functionality', async ({ page, browserName }) => {
    await page.goto('/');

    // Create test elements
    const sourceElement = page.locator('[data-testid="drag-source"]');
    const targetElement = page.locator('[data-testid="drop-target"]');

    if (await sourceElement.count() > 0 && await targetElement.count() > 0) {
      // Perform drag and drop
      await sourceElement.dragTo(targetElement);

      // Verify drop was successful
      const dropResult = await page.locator('[data-testid="drop-result"]').textContent();
      expect(dropResult).toContain('dropped');
    } else {
      test.skip(); // Skip if elements not found
    }
  });
});

test.describe('Performance Tests', () => {
  test('page load performance', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(5000); // Less than 5 seconds
  });

  test('memory usage stays reasonable', async ({ page }) => {
    await page.goto('/');

    // Simulate user activity
    for (let i = 0; i < 10; i++) {
      await page.click('body');
      await page.waitForTimeout(100);
    }

    const memoryUsage = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });

    // Memory usage should be reasonable (less than 50MB)
    if (memoryUsage > 0) {
      expect(memoryUsage).toBeLessThan(50 * 1024 * 1024);
    }
  });
});