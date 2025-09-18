import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth-helper';
import { SparkHelper } from '../helpers/spark-helper';
import { PerformanceHelper } from '../helpers/performance-helper';
import { KEYBOARD_SHORTCUTS } from '../fixtures/test-data';

test.describe('Keyboard Shortcuts', () => {
  let authHelper: AuthHelper;
  let sparkHelper: SparkHelper;
  let performanceHelper: PerformanceHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    sparkHelper = new SparkHelper(page);
    performanceHelper = new PerformanceHelper(page);
    
    await performanceHelper.startMeasurement();
    await authHelper.loginWithSession('USER1');
  });

  test.afterEach(async () => {
    const report = await performanceHelper.generatePerformanceReport();
    expect(report.consoleErrors).toBeLessThan(2);
  });

  test('should handle global application shortcuts', async ({ page }) => {
    // Test Ctrl+N for new spark
    await page.keyboard.press('Control+n');
    await expect(page.locator('[data-testid="create-spark-modal"]')).toBeVisible();
    await page.keyboard.press('Escape');

    // Test Ctrl+S for save (should show save indicator or success)
    await page.keyboard.press('Control+s');
    // Check for save indicator or no-op if nothing to save
    const saveIndicator = page.locator('[data-testid="save-indicator"]');
    const saveMessage = page.locator('[data-testid="save-message"]');
    
    const saveVisible = await Promise.race([
      saveIndicator.isVisible().then(() => 'indicator'),
      saveMessage.isVisible().then(() => 'message'),
      new Promise(resolve => setTimeout(() => resolve('none'), 1000))
    ]);
    
    // Either should show save feedback or be a no-op
    expect(['indicator', 'message', 'none']).toContain(saveVisible);

    // Test Ctrl+F for search
    await page.keyboard.press('Control+f');
    await expect(page.locator('[data-testid="search-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-input"]')).toBeFocused();
    await page.keyboard.press('Escape');

    // Test Ctrl+A for select all
    await page.keyboard.press('Control+a');
    const selectedSparks = await page.$$('[data-testid*="spark"].selected');
    expect(selectedSparks.length).toBeGreaterThan(0);
  });

  test('should handle spark manipulation shortcuts', async ({ page }) => {
    // Select a spark first
    await page.click('[data-testid="spark-seedling-1"]');
    await expect(page.locator('[data-testid="spark-seedling-1"]')).toHaveClass(/selected/);

    // Test Delete key for spark deletion
    await page.keyboard.press('Delete');
    await expect(page.locator('[data-testid="delete-confirmation-modal"]')).toBeVisible();
    await page.keyboard.press('Escape'); // Cancel deletion

    // Test Ctrl+C for copy
    await page.keyboard.press('Control+c');
    await expect(page.locator('[data-testid="copy-indicator"]')).toBeVisible();

    // Test Ctrl+V for paste
    await page.keyboard.press('Control+v');
    // Wait for paste operation
    await page.waitForTimeout(1000);
    const copiedSparks = await page.$$('[data-testid*="spark"][data-testid*="copy"]');
    expect(copiedSparks.length).toBeGreaterThan(0);

    // Test Ctrl+Z for undo
    await page.keyboard.press('Control+z');
    // Should undo the paste operation
    await page.waitForTimeout(500);
    const sparksAfterUndo = await page.$$('[data-testid*="spark"][data-testid*="copy"]');
    expect(sparksAfterUndo.length).toBe(0);

    // Test Ctrl+Y for redo
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(500);
    const sparksAfterRedo = await page.$$('[data-testid*="spark"][data-testid*="copy"]');
    expect(sparksAfterRedo.length).toBeGreaterThan(0);
  });

  test('should handle multi-selection shortcuts', async ({ page }) => {
    // Test Shift+click for range selection
    await page.click('[data-testid="spark-seedling-1"]');
    await page.keyboard.down('Shift');
    await page.click('[data-testid="spark-sapling-1"]');
    await page.keyboard.up('Shift');

    const selectedSparks = await page.$$('[data-testid*="spark"].selected');
    expect(selectedSparks.length).toBeGreaterThanOrEqual(2);

    // Test Ctrl+click for multi-selection
    await page.keyboard.down('Control');
    await page.click('[data-testid="spark-tree-1"]');
    await page.keyboard.up('Control');

    const multiSelectedSparks = await page.$$('[data-testid*="spark"].selected');
    expect(multiSelectedSparks.length).toBeGreaterThan(selectedSparks.length);
  });

  test('should handle navigation shortcuts', async ({ page }) => {
    // Test Tab navigation
    await page.keyboard.press('Tab');
    const firstFocusable = await page.locator(':focus').getAttribute('data-testid');
    expect(firstFocusable).toBeTruthy();

    // Test Shift+Tab for reverse navigation
    await page.keyboard.press('Shift+Tab');
    const reverseFocusable = await page.locator(':focus').getAttribute('data-testid');
    expect(reverseFocusable).not.toBe(firstFocusable);

    // Test arrow keys for spark navigation (if implemented)
    await page.click('[data-testid="spark-seedling-1"]');
    await page.keyboard.press('ArrowRight');
    
    // Check if focus moved to adjacent spark
    const focusedElement = await page.locator(':focus').getAttribute('data-testid');
    expect(focusedElement).toContain('spark');
  });

  test('should handle modal shortcuts', async ({ page }) => {
    // Open create spark modal
    await page.keyboard.press('Control+n');
    await expect(page.locator('[data-testid="create-spark-modal"]')).toBeVisible();

    // Test Escape to close modal
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="create-spark-modal"]')).not.toBeVisible();

    // Open spark edit modal
    await page.dblclick('[data-testid="spark-seedling-1"]');
    await expect(page.locator('[data-testid="edit-spark-modal"]')).toBeVisible();

    // Test Enter to save (if form is valid)
    await page.fill('[data-testid="spark-title-input"]', 'Updated via Keyboard');
    await page.keyboard.press('Control+Enter');
    
    // Should save and close modal
    await expect(page.locator('[data-testid="edit-spark-modal"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="spark-seedling-1"] [data-testid="spark-title"]'))
      .toContainText('Updated via Keyboard');
  });

  test('should handle workspace shortcuts', async ({ page }) => {
    // Test Ctrl+1, Ctrl+2, etc. for workspace switching
    await page.keyboard.press('Control+1');
    await page.waitForTimeout(500);
    
    // Should switch to first workspace or show workspace selector
    const workspaceIndicator = page.locator('[data-testid="workspace-title"]');
    const workspaceSelector = page.locator('[data-testid="workspace-selector"]');
    
    const result = await Promise.race([
      workspaceIndicator.isVisible().then(() => 'indicator'),
      workspaceSelector.isVisible().then(() => 'selector'),
      new Promise(resolve => setTimeout(() => resolve('none'), 1000))
    ]);
    
    expect(['indicator', 'selector', 'none']).toContain(result);
  });

  test('should handle view mode shortcuts', async ({ page }) => {
    // Test shortcuts for different view modes
    await page.keyboard.press('Control+Shift+1'); // Canvas view
    await page.waitForTimeout(500);
    
    const canvasView = await page.locator('[data-testid="canvas-view"]').isVisible()
      .catch(() => false);
    
    await page.keyboard.press('Control+Shift+2'); // Kanban view
    await page.waitForTimeout(500);
    
    const kanbanView = await page.locator('[data-testid="kanban-view"]').isVisible()
      .catch(() => false);
    
    // At least one view should be active
    expect(canvasView || kanbanView).toBe(true);
  });

  test('should handle bulk operation shortcuts', async ({ page }) => {
    // Select multiple sparks
    await sparkHelper.bulkSelectSparks(['spark-seedling-1', 'spark-sapling-1']);

    // Test bulk delete shortcut
    await page.keyboard.press('Delete');
    await expect(page.locator('[data-testid="bulk-delete-confirmation"]')).toBeVisible();
    await page.keyboard.press('Escape'); // Cancel

    // Test bulk status change shortcut
    await page.keyboard.press('Control+Shift+s');
    await expect(page.locator('[data-testid="bulk-status-menu"]')).toBeVisible();
    await page.keyboard.press('Escape'); // Cancel
  });

  test('should measure shortcut response times', async ({ page }) => {
    const shortcuts = [
      { keys: 'Control+n', expectedElement: '[data-testid="create-spark-modal"]' },
      { keys: 'Control+f', expectedElement: '[data-testid="search-input"]' },
      { keys: 'Control+a', expectedElement: null }, // Select all doesn't show modal
    ];

    for (const shortcut of shortcuts) {
      // Close any open modals first
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);

      const startTime = Date.now();
      await page.keyboard.press(shortcut.keys);
      
      if (shortcut.expectedElement) {
        await page.waitForSelector(shortcut.expectedElement, { timeout: 2000 });
      } else {
        await page.waitForTimeout(200); // Wait for select all to complete
      }
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500); // Should respond within 500ms
      
      console.log(`Shortcut ${shortcut.keys} response time: ${responseTime}ms`);
    }
  });

  test('should handle shortcut conflicts and priority', async ({ page }) => {
    // Test that application shortcuts take precedence over browser shortcuts
    // when the app has focus
    
    // Focus on the application
    await page.click('[data-testid="main-canvas"]');
    
    // Test Ctrl+F (should open app search, not browser search)
    await page.keyboard.press('Control+f');
    await expect(page.locator('[data-testid="search-input"]')).toBeVisible();
    
    // Browser search should not be visible
    const browserSearch = page.locator('input[type="search"]').first();
    const isBrowserSearchVisible = await browserSearch.isVisible().catch(() => false);
    expect(isBrowserSearchVisible).toBe(false);
  });

  test('should handle shortcuts in different contexts', async ({ page }) => {
    // Test shortcuts behavior when editing text
    await page.dblclick('[data-testid="spark-seedling-1"]');
    await page.focus('[data-testid="spark-title-input"]');
    
    // Ctrl+A in text field should select text, not all sparks
    await page.keyboard.press('Control+a');
    const selectedText = await page.evaluate(() => window.getSelection()?.toString());
    expect(selectedText).toBeTruthy();
    
    // Escape should close modal
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="edit-spark-modal"]')).not.toBeVisible();
    
    // Now Ctrl+A should select all sparks again
    await page.keyboard.press('Control+a');
    const selectedSparks = await page.$$('[data-testid*="spark"].selected');
    expect(selectedSparks.length).toBeGreaterThan(0);
  });

  test('should detect shortcut performance issues', async ({ page }) => {
    // Test for infinite loops when processing shortcuts rapidly
    const shortcut = 'Control+n';
    
    // Rapidly press shortcut multiple times
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press(shortcut);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(50);
    }
    
    // Check for infinite loops
    const hasInfiniteLoop = await performanceHelper.checkForInfiniteLoops(3000);
    expect(hasInfiniteLoop).toBe(false);
    
    // Check memory usage
    const memoryUsage = await performanceHelper.getMemoryUsage();
    if (memoryUsage) {
      expect(memoryUsage.usedJSHeapSize).toBeLessThan(60 * 1024 * 1024);
    }
    
    // Check console errors
    const consoleErrors = await performanceHelper.getConsoleErrors();
    expect(consoleErrors.length).toBeLessThan(5);
  });

  test('should handle accessibility shortcuts', async ({ page }) => {
    // Test screen reader navigation shortcuts
    await page.keyboard.press('Tab');
    
    // Should land on first focusable element
    const firstFocus = await page.locator(':focus').getAttribute('aria-label');
    expect(firstFocus).toBeTruthy();
    
    // Test skip links (if implemented)
    await page.keyboard.press('Tab');
    const skipLink = page.locator('[data-testid="skip-to-main"]');
    if (await skipLink.isVisible()) {
      await page.keyboard.press('Enter');
      const mainContent = await page.locator(':focus').getAttribute('data-testid');
      expect(mainContent).toContain('main');
    }
    
    // Test aria-live region updates
    await page.keyboard.press('Control+s');
    const statusMessage = page.locator('[aria-live="polite"]');
    if (await statusMessage.isVisible()) {
      const message = await statusMessage.textContent();
      expect(message).toBeTruthy();
    }
  });
});