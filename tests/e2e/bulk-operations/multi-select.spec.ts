import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth-helper';
import { SparkHelper } from '../helpers/spark-helper';
import { PerformanceHelper } from '../helpers/performance-helper';
import { TEST_SPARKS } from '../fixtures/test-data';

test.describe('Multi-Select Bulk Operations', () => {
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
    expect(report.consoleErrors).toBeLessThan(3);
  });

  test('should select multiple sparks using Ctrl+click', async ({ page }) => {
    const sparkIds = [TEST_SPARKS.SEEDLING.id, TEST_SPARKS.SAPLING.id, TEST_SPARKS.TREE.id];
    
    // Measure selection performance
    const selectionStart = Date.now();
    const selectedCount = await sparkHelper.bulkSelectSparks(sparkIds);
    const selectionTime = Date.now() - selectionStart;
    
    expect(selectedCount).toBe(sparkIds.length);
    expect(selectionTime).toBeLessThan(1000); // Selection should be fast
    
    // Verify visual selection state
    for (const sparkId of sparkIds) {
      await expect(page.locator(`[data-testid="spark-${sparkId}"]`))
        .toHaveClass(/selected/);
    }
    
    // Check selection counter
    await expect(page.locator('[data-testid="selection-counter"]'))
      .toContainText(`${sparkIds.length} selected`);
  });

  test('should select all sparks with Ctrl+A', async ({ page }) => {
    const selectedCount = await sparkHelper.selectAllSparks();
    
    expect(selectedCount).toBeGreaterThan(0);
    
    // Verify selection counter shows all
    await expect(page.locator('[data-testid="selection-counter"]'))
      .toContainText(`${selectedCount} selected`);
    
    // Should show bulk action toolbar
    await expect(page.locator('[data-testid="bulk-action-toolbar"]'))
      .toBeVisible();
  });

  test('should handle range selection with Shift+click', async ({ page }) => {
    // Click first spark
    await page.click(`[data-testid="spark-${TEST_SPARKS.SEEDLING.id}"]`);
    
    // Shift+click last spark to select range
    await page.keyboard.down('Shift');
    await page.click(`[data-testid="spark-${TEST_SPARKS.TREE.id}"]`);
    await page.keyboard.up('Shift');
    
    // Should select all sparks in between (implementation dependent)
    const selectedSparks = await page.$$('[data-testid*="spark"].selected');
    expect(selectedSparks.length).toBeGreaterThanOrEqual(2);
  });

  test('should perform bulk status changes', async ({ page }) => {
    const sparkIds = [TEST_SPARKS.SEEDLING.id, TEST_SPARKS.SAPLING.id];
    
    await sparkHelper.bulkSelectSparks(sparkIds);
    
    // Measure bulk operation performance
    const operationStart = Date.now();
    await sparkHelper.bulkChangeStatus(sparkIds, 'TREE');
    const operationTime = Date.now() - operationStart;
    
    expect(operationTime).toBeLessThan(3000); // Should complete within 3 seconds
    
    // Verify all selected sparks have new status
    for (const sparkId of sparkIds) {
      await expect(page.locator(`[data-testid="spark-${sparkId}"] [data-testid="spark-status"]`))
        .toContainText('TREE');
    }
    
    // Check for success notification
    await expect(page.locator('[data-testid="bulk-status-success"]'))
      .toContainText(`Updated ${sparkIds.length} sparks to TREE status`);
  });

  test('should perform bulk deletion with confirmation', async ({ page }) => {
    // Create temporary sparks for deletion test
    const tempSparks = [];
    for (let i = 0; i < 3; i++) {
      const title = `Temp Spark ${i} ${Date.now()}`;
      await sparkHelper.createSpark(title, `Temporary spark ${i}`);
      tempSparks.push(title);
    }
    
    // Find and select the temporary sparks
    const tempSparkElements = await page.$$('[data-testid*="spark"][data-testid*="Temp Spark"]');
    
    // Select the temporary sparks
    await page.click(`[data-testid*="spark"][data-testid*="${tempSparks[0]}"]`);
    for (let i = 1; i < tempSparkElements.length; i++) {
      await page.keyboard.down('Control');
      await page.click(`[data-testid*="spark"][data-testid*="${tempSparks[i]}"]`);
      await page.keyboard.up('Control');
    }
    
    // Delete selected sparks
    await page.keyboard.press('Delete');
    
    // Should show bulk delete confirmation
    await expect(page.locator('[data-testid="bulk-delete-confirmation"]'))
      .toContainText(`Delete ${tempSparkElements.length} selected sparks?`);
    
    // Confirm deletion
    await page.click('[data-testid="confirm-bulk-delete"]');
    
    // Verify sparks are deleted
    for (const title of tempSparks) {
      await expect(page.locator(`[data-testid*="spark"][data-testid*="${title}"]`))
        .not.toBeVisible();
    }
    
    // Check for success notification
    await expect(page.locator('[data-testid="bulk-delete-success"]'))
      .toContainText(`Deleted ${tempSparkElements.length} sparks`);
  });

  test('should handle bulk copy and paste operations', async ({ page }) => {
    const sparkIds = [TEST_SPARKS.SEEDLING.id, TEST_SPARKS.SAPLING.id];
    
    await sparkHelper.bulkSelectSparks(sparkIds);
    
    // Copy selected sparks
    await sparkHelper.copySelectedSparks();
    
    // Paste sparks
    const pastedCount = await sparkHelper.pasteSparksCopies();
    expect(pastedCount).toBe(sparkIds.length);
    
    // Verify copied sparks have different IDs but similar content
    for (let i = 0; i < sparkIds.length; i++) {
      await expect(page.locator(`[data-testid*="spark"][data-testid*="copy"]`).nth(i))
        .toBeVisible();
    }
    
    // Check for paste success notification
    await expect(page.locator('[data-testid="paste-success"]'))
      .toContainText(`Pasted ${pastedCount} spark copies`);
  });

  test('should handle bulk export operations', async ({ page }) => {
    const sparkIds = [TEST_SPARKS.SEEDLING.id, TEST_SPARKS.SAPLING.id, TEST_SPARKS.TREE.id];
    
    await sparkHelper.bulkSelectSparks(sparkIds);
    
    // Test bulk export
    const exportResult = await sparkHelper.exportSparks('JSON');
    
    expect(exportResult.filename).toContain('.json');
    expect(exportResult.filename).toContain('sparks');
    
    // Check export success notification
    await expect(page.locator('[data-testid="export-success"]'))
      .toContainText(`Exported ${sparkIds.length} sparks`);
  });

  test('should handle bulk tag operations', async ({ page }) => {
    const sparkIds = [TEST_SPARKS.SEEDLING.id, TEST_SPARKS.SAPLING.id];
    const testTag = `bulk-tag-${Date.now()}`;
    
    await sparkHelper.bulkSelectSparks(sparkIds);
    
    // Open bulk tag dialog
    await page.click('[data-testid="bulk-action-toolbar"] [data-testid="bulk-tag-button"]');
    
    // Add tag to selected sparks
    await page.fill('[data-testid="bulk-tag-input"]', testTag);
    await page.click('[data-testid="apply-bulk-tag"]');
    
    // Verify tag was added to all selected sparks
    for (const sparkId of sparkIds) {
      await expect(page.locator(`[data-testid="spark-${sparkId}"] [data-testid="spark-tag-${testTag}"]`))
        .toBeVisible();
    }
    
    // Check for success notification
    await expect(page.locator('[data-testid="bulk-tag-success"]'))
      .toContainText(`Added tag "${testTag}" to ${sparkIds.length} sparks`);
  });

  test('should handle boundary conditions for bulk operations', async ({ page }) => {
    // Test selecting maximum number of sparks
    const allSparks = await page.$$('[data-testid*="spark"]');
    const maxSelectCount = Math.min(allSparks.length, 100); // Assume 100 is max
    
    if (maxSelectCount > 10) {
      // Select many sparks
      await sparkHelper.selectAllSparks();
      
      // Should handle large selection
      const selectedCount = await page.$$('[data-testid*="spark"].selected');
      expect(selectedCount.length).toBeGreaterThan(0);
      
      // Performance should still be reasonable
      const memoryUsage = await performanceHelper.getMemoryUsage();
      if (memoryUsage) {
        expect(memoryUsage.usedJSHeapSize).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
      }
    }
    
    // Test empty selection operations
    await page.click('[data-testid="main-canvas"]'); // Deselect all
    
    // Try bulk operations with no selection
    await page.keyboard.press('Delete');
    
    // Should show "no selection" message
    await expect(page.locator('[data-testid="no-selection-message"]'))
      .toContainText('No sparks selected');
  });

  test('should handle bulk operations during network issues', async ({ page }) => {
    const sparkIds = [TEST_SPARKS.SEEDLING.id, TEST_SPARKS.SAPLING.id];
    
    await sparkHelper.bulkSelectSparks(sparkIds);
    
    // Simulate network interruption
    await page.context().setOffline(true);
    
    // Attempt bulk status change
    await page.click('[data-testid="bulk-action-toolbar"] [data-testid="bulk-status-button"]');
    await page.click('[data-testid="bulk-status-tree"]');
    
    // Should show offline indicator
    await expect(page.locator('[data-testid="offline-indicator"]'))
      .toBeVisible();
    
    // Should queue the operation
    await expect(page.locator('[data-testid="operation-queued"]'))
      .toContainText('Operation queued for when online');
    
    // Restore network
    await page.context().setOffline(false);
    
    // Should process queued operation
    await expect(page.locator('[data-testid="online-indicator"]'))
      .toBeVisible();
    
    // Wait for operation to complete
    await page.waitForTimeout(2000);
    
    // Verify operation was applied
    for (const sparkId of sparkIds) {
      await expect(page.locator(`[data-testid="spark-${sparkId}"] [data-testid="spark-status"]`))
        .toContainText('TREE');
    }
  });

  test('should provide visual feedback during bulk operations', async ({ page }) => {
    const sparkIds = [TEST_SPARKS.SEEDLING.id, TEST_SPARKS.SAPLING.id, TEST_SPARKS.TREE.id];
    
    await sparkHelper.bulkSelectSparks(sparkIds);
    
    // Start bulk operation
    await page.click('[data-testid="bulk-action-toolbar"] [data-testid="bulk-status-button"]');
    await page.click('[data-testid="bulk-status-sapling"]');
    
    // Should show progress indicator
    await expect(page.locator('[data-testid="bulk-operation-progress"]'))
      .toBeVisible();
    
    // Should show progress bar or percentage
    const progressElement = page.locator('[data-testid="progress-bar"]');
    if (await progressElement.isVisible()) {
      // Check that progress updates
      const initialProgress = await progressElement.getAttribute('value');
      await page.waitForTimeout(500);
      const updatedProgress = await progressElement.getAttribute('value');
      
      expect(updatedProgress).not.toBe(initialProgress);
    }
    
    // Should show completion state
    await expect(page.locator('[data-testid="bulk-operation-complete"]'))
      .toBeVisible({ timeout: 5000 });
  });

  test('should handle undo/redo for bulk operations', async ({ page }) => {
    const sparkIds = [TEST_SPARKS.SEEDLING.id, TEST_SPARKS.SAPLING.id];
    
    // Record initial states
    const initialStates = {};
    for (const sparkId of sparkIds) {
      const statusElement = page.locator(`[data-testid="spark-${sparkId}"] [data-testid="spark-status"]`);
      initialStates[sparkId] = await statusElement.textContent();
    }
    
    await sparkHelper.bulkSelectSparks(sparkIds);
    
    // Perform bulk status change
    await sparkHelper.bulkChangeStatus(sparkIds, 'FOREST');
    
    // Verify changes applied
    for (const sparkId of sparkIds) {
      await expect(page.locator(`[data-testid="spark-${sparkId}"] [data-testid="spark-status"]`))
        .toContainText('FOREST');
    }
    
    // Undo the bulk operation
    await page.keyboard.press('Control+z');
    
    // Should revert to initial states
    for (const sparkId of sparkIds) {
      await expect(page.locator(`[data-testid="spark-${sparkId}"] [data-testid="spark-status"]`))
        .toContainText(initialStates[sparkId]);
    }
    
    // Redo the operation
    await page.keyboard.press('Control+y');
    
    // Should reapply changes
    for (const sparkId of sparkIds) {
      await expect(page.locator(`[data-testid="spark-${sparkId}"] [data-testid="spark-status"]`))
        .toContainText('FOREST');
    }
  });

  test('should measure bulk operation performance', async ({ page }) => {
    // Create larger dataset for performance testing
    const testSparks = [];
    for (let i = 0; i < 20; i++) {
      const title = `Perf Test Spark ${i}`;
      await sparkHelper.createSpark(title, `Performance test spark ${i}`);
      testSparks.push(title);
    }
    
    // Select all test sparks
    await page.click(`[data-testid*="spark"][data-testid*="${testSparks[0]}"]`);
    for (let i = 1; i < testSparks.length; i++) {
      await page.keyboard.down('Control');
      await page.click(`[data-testid*="spark"][data-testid*="${testSparks[i]}"]`);
      await page.keyboard.up('Control');
    }
    
    // Measure bulk status change performance
    const operationStart = Date.now();
    
    await page.click('[data-testid="bulk-action-toolbar"] [data-testid="bulk-status-button"]');
    await page.click('[data-testid="bulk-status-sapling"]');
    
    // Wait for operation to complete
    await page.waitForSelector('[data-testid="bulk-operation-complete"]', { timeout: 10000 });
    
    const operationTime = Date.now() - operationStart;
    const timePerSpark = operationTime / testSparks.length;
    
    expect(operationTime).toBeLessThan(10000); // Should complete within 10 seconds
    expect(timePerSpark).toBeLessThan(500); // Should process each spark within 500ms
    
    console.log(`Bulk operation time: ${operationTime}ms for ${testSparks.length} sparks`);
    console.log(`Time per spark: ${timePerSpark}ms`);
    
    // Check memory usage after bulk operation
    const memoryUsage = await performanceHelper.getMemoryUsage();
    if (memoryUsage) {
      expect(memoryUsage.usedJSHeapSize).toBeLessThan(120 * 1024 * 1024); // Less than 120MB
    }
    
    // Clean up test sparks
    await page.keyboard.press('Delete');
    await page.click('[data-testid="confirm-bulk-delete"]');
  });

  test('should detect infinite loops in bulk operations', async ({ page }) => {
    const sparkIds = [TEST_SPARKS.SEEDLING.id, TEST_SPARKS.SAPLING.id];
    
    await sparkHelper.bulkSelectSparks(sparkIds);
    
    // Start monitoring for infinite loops
    const infiniteLoopPromise = performanceHelper.checkForInfiniteLoops(8000);
    
    // Perform bulk operation
    const operationPromise = sparkHelper.bulkChangeStatus(sparkIds, 'TREE');
    
    // Wait for both to complete
    const [hasInfiniteLoop, operationResult] = await Promise.all([
      infiniteLoopPromise,
      operationPromise.catch(() => 'error')
    ]);
    
    expect(hasInfiniteLoop).toBe(false);
    expect(operationResult).not.toBe('error');
  });

  test('should handle accessibility in bulk operations', async ({ page }) => {
    // Test keyboard navigation through bulk selection
    await page.keyboard.press('Tab');
    
    // Should be able to navigate to sparks with keyboard
    let focusedElement = await page.locator(':focus').getAttribute('data-testid');
    expect(focusedElement).toContain('spark');
    
    // Test space bar for selection
    await page.keyboard.press('Space');
    
    // Should select the focused spark
    const isSelected = await page.locator(':focus').evaluate(el => 
      el.classList.contains('selected')
    );
    expect(isSelected).toBe(true);
    
    // Test arrow key navigation
    await page.keyboard.press('ArrowDown');
    focusedElement = await page.locator(':focus').getAttribute('data-testid');
    
    // Should move focus to next spark
    expect(focusedElement).toContain('spark');
    
    // Test screen reader announcements
    const ariaLiveRegion = page.locator('[aria-live="polite"]');
    if (await ariaLiveRegion.isVisible()) {
      const announcement = await ariaLiveRegion.textContent();
      expect(announcement).toBeTruthy();
    }
  });
});