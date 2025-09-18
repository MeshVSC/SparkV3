import { test, expect } from '@playwright/test';

test.describe('Mobile and Responsive Design', () => {
  test('mobile navigation patterns', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
    
    const mobileNavSelectors = [
      '[data-testid="mobile-nav"]',
      '[data-testid="bottom-navigation"]',
      '.mobile-navigation'
    ];
    
    for (const selector of mobileNavSelectors) {
      const mobileNav = page.locator(selector);
      if (await mobileNav.isVisible()) {
        const tabs = mobileNav.locator('button, [role="tab"]');
        const tabCount = await tabs.count();
        
        for (let i = 0; i < Math.min(tabCount, 3); i++) {
          await tabs.nth(i).tap();
          await page.waitForTimeout(500);
        }
        break;
      }
    }
  });

  test('responsive breakpoints', async ({ page }) => {
    await page.goto('/app');
    
    const breakpoints = [
      { width: 320, height: 568 },  // Mobile small
      { width: 375, height: 667 },  // Mobile
      { width: 768, height: 1024 }, // Tablet
      { width: 1024, height: 768 }, // Tablet landscape
      { width: 1200, height: 800 }  // Desktop
    ];
    
    for (const { width, height } of breakpoints) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(500);
      
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('touch gesture handling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/app');
    await page.waitForSelector('#spark-canvas', { timeout: 10000 });
    
    const canvas = page.locator('#spark-canvas');
    const canvasBounds = await canvas.boundingBox();
    
    if (canvasBounds) {
      const centerX = canvasBounds.x + canvasBounds.width / 2;
      const centerY = canvasBounds.y + canvasBounds.height / 2;
      
      await page.touchscreen.tap(centerX, centerY);
      await page.waitForTimeout(300);
      
      await page.touchscreen.tap(centerX, centerY);
      await page.waitForTimeout(100);
      await page.touchscreen.tap(centerX, centerY);
      await page.waitForTimeout(300);
    }
  });
});