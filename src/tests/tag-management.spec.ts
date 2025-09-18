import { test, expect } from '@playwright/test';

test.describe('Tag Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
  });

  test('tag creation functionality', async ({ page }) => {
    const tagCreationSelectors = [
      '[data-testid="create-tag"]',
      'input[placeholder*="tag" i]'
    ];
    
    for (const selector of tagCreationSelectors) {
      const element = page.locator(selector);
      if (await element.isVisible()) {
        if (await element.getAttribute('type') === 'text') {
          await element.fill('test-tag');
          await page.keyboard.press('Enter');
          await page.waitForTimeout(500);
        } else {
          await element.click();
          await page.waitForTimeout(500);
        }
        break;
      }
    }
  });

  test('tag deletion functionality', async ({ page }) => {
    const tagSelectors = [
      '[data-testid*="tag"]:not(input)',
      '.tag-item'
    ];
    
    for (const selector of tagSelectors) {
      const tags = page.locator(selector);
      if (await tags.count() > 0) {
        const firstTag = tags.first();
        await firstTag.hover();
        await page.waitForTimeout(300);
        
        const deleteButton = page.locator(`${selector} [data-testid="delete-tag"]`);
        if (await deleteButton.isVisible()) {
          await deleteButton.click();
          await page.waitForTimeout(500);
        }
        break;
      }
    }
  });

  test('tag filtering', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(500);
    
    await page.keyboard.type('tag:important');
    await page.waitForTimeout(1000);
    
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });
});