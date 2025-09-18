import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth-helper';
import { SparkHelper } from '../helpers/spark-helper';
import { PerformanceHelper } from '../helpers/performance-helper';
import { TEST_SPARKS } from '../fixtures/test-data';

test.describe('Task Management Workflows', () => {
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

  test('should complete full spark lifecycle', async ({ page }) => {
    const sparkTitle = `Lifecycle Test ${Date.now()}`;
    
    // Create new spark
    await sparkHelper.createSpark(sparkTitle, 'Test description', '# Test Content\nThis is test content.');
    
    // Edit spark
    const newTitle = `${sparkTitle} - Updated`;
    await sparkHelper.editSpark(TEST_SPARKS.SEEDLING.id, newTitle, 'Updated description');
    
    // Change status from SEEDLING to SAPLING
    await sparkHelper.changeSparkStatus(TEST_SPARKS.SEEDLING.id, 'SAPLING');
    
    // Add tags
    await sparkHelper.addTagToSpark(TEST_SPARKS.SEEDLING.id, 'lifecycle-test');
    
    // Move spark position
    await sparkHelper.dragSparkToPosition(TEST_SPARKS.SEEDLING.id, 400, 300);
    
    // Progress through all statuses
    await sparkHelper.changeSparkStatus(TEST_SPARKS.SEEDLING.id, 'TREE');
    await sparkHelper.changeSparkStatus(TEST_SPARKS.SEEDLING.id, 'FOREST');
    
    // Verify final state
    await expect(page.locator(`[data-testid="spark-${TEST_SPARKS.SEEDLING.id}"] [data-testid="spark-status"]`))
      .toContainText('FOREST');
  });

  test('should handle spark creation performance', async ({ page }) => {
    const startTime = Date.now();
    
    await sparkHelper.createSpark('Performance Test Spark', 'Testing performance');
    
    const endTime = Date.now();
    const creationTime = endTime - startTime;
    
    expect(creationTime).toBeLessThan(2000); // Should take less than 2 seconds
    
    // Check memory usage after creation
    const memoryUsage = await performanceHelper.getMemoryUsage();
    if (memoryUsage) {
      expect(memoryUsage.usedJSHeapSize).toBeLessThan(50 * 1024 * 1024);
    }
  });

  test('should support drag and drop positioning', async ({ page }) => {
    const targetX = 350;
    const targetY = 250;
    
    await sparkHelper.dragSparkToPosition(TEST_SPARKS.SEEDLING.id, targetX, targetY);
    
    // Verify position was updated (approximately)
    const sparkElement = page.locator(`[data-testid="spark-${TEST_SPARKS.SEEDLING.id}"]`);
    const boundingBox = await sparkElement.boundingBox();
    
    if (boundingBox) {
      expect(Math.abs(boundingBox.x - targetX)).toBeLessThan(50);
      expect(Math.abs(boundingBox.y - targetY)).toBeLessThan(50);
    }
  });

  test('should create and manage spark connections', async ({ page }) => {
    // Create connection between two sparks
    await sparkHelper.connectSparks(
      TEST_SPARKS.SEEDLING.id,
      TEST_SPARKS.SAPLING.id,
      'DEPENDS_ON'
    );
    
    // Verify connection visualization
    await expect(page.locator(`[data-testid="connection-${TEST_SPARKS.SEEDLING.id}-${TEST_SPARKS.SAPLING.id}"]`))
      .toBeVisible();
    
    // Create another connection
    await sparkHelper.connectSparks(
      TEST_SPARKS.SAPLING.id,
      TEST_SPARKS.TREE.id,
      'INSPIRES'
    );
    
    // Verify multiple connections exist
    await expect(page.locator('[data-testid*="connection-"]')).toHaveCount(2);
  });

  test('should handle todo management within sparks', async ({ page }) => {
    // Open spark details
    await page.dblclick(`[data-testid="spark-${TEST_SPARKS.SEEDLING.id}"]`);
    
    // Add new todo
    await page.click('[data-testid="add-todo-button"]');
    await page.fill('[data-testid="todo-title-input"]', 'New Todo Item');
    await page.selectOption('[data-testid="todo-priority-select"]', 'HIGH');
    await page.click('[data-testid="save-todo-button"]');
    
    // Verify todo appears
    await expect(page.locator('[data-testid*="todo-"][data-testid*="New Todo Item"]'))
      .toBeVisible();
    
    // Mark todo as complete
    await page.click('[data-testid*="todo-checkbox-"]');
    
    // Verify completion status
    await expect(page.locator('[data-testid*="todo-"][data-testid*="New Todo Item"]'))
      .toHaveClass(/completed/);
  });

  test('should handle spark search and filtering', async ({ page }) => {
    // Test search functionality
    const searchResults = await sparkHelper.searchSparks('E2E Test');
    expect(searchResults).toBeGreaterThan(0);
    
    // Clear search
    await page.keyboard.press('Escape');
    
    // Test tag filtering
    const tagResults = await sparkHelper.filterSparksByTag('testing');
    expect(tagResults).toBeGreaterThan(0);
  });

  test('should export and import sparks', async ({ page }) => {
    // Test export
    const exportResult = await sparkHelper.exportSparks('JSON');
    expect(exportResult.filename).toContain('.json');
    
    // Test import (using the same file we just exported)
    if (exportResult.path) {
      const importCount = await sparkHelper.importSparks(exportResult.path);
      expect(importCount).toBeGreaterThan(0);
    }
  });

  test('should handle concurrent spark editing', async ({ page, context }) => {
    // Open second tab to simulate concurrent editing
    const secondTab = await context.newPage();
    const secondAuthHelper = new AuthHelper(secondTab);
    const secondSparkHelper = new SparkHelper(secondTab);
    
    await secondAuthHelper.loginWithSession('USER2');
    
    // Edit same spark from both tabs
    const newTitle1 = 'Edit from Tab 1';
    const newTitle2 = 'Edit from Tab 2';
    
    // Start editing from both tabs
    await Promise.all([
      sparkHelper.editSpark(TEST_SPARKS.SHARED.id, newTitle1),
      secondSparkHelper.editSpark(TEST_SPARKS.SHARED.id, newTitle2)
    ]);
    
    // Verify conflict resolution
    // The last edit should win, or there should be a conflict indicator
    const finalTitle = await page.locator(`[data-testid="spark-${TEST_SPARKS.SHARED.id}"] [data-testid="spark-title"]`)
      .textContent();
    
    expect([newTitle1, newTitle2]).toContain(finalTitle);
    
    await secondTab.close();
  });

  test('should handle bulk operations with performance monitoring', async ({ page }) => {
    const sparkIds = [TEST_SPARKS.SEEDLING.id, TEST_SPARKS.SAPLING.id, TEST_SPARKS.TREE.id];
    
    // Measure bulk selection performance
    const selectionStart = Date.now();
    await sparkHelper.bulkSelectSparks(sparkIds);
    const selectionTime = Date.now() - selectionStart;
    
    expect(selectionTime).toBeLessThan(1000);
    
    // Measure bulk status change performance
    const statusChangeStart = Date.now();
    await sparkHelper.bulkChangeStatus(sparkIds, 'SAPLING');
    const statusChangeTime = Date.now() - statusChangeStart;
    
    expect(statusChangeTime).toBeLessThan(2000);
    
    // Verify all sparks have new status
    for (const sparkId of sparkIds) {
      await expect(page.locator(`[data-testid="spark-${sparkId}"] [data-testid="spark-status"]`))
        .toContainText('SAPLING');
    }
  });

  test('should handle network interruptions during task operations', async ({ page }) => {
    const sparkTitle = `Network Test ${Date.now()}`;
    
    // Start creating spark
    await page.click('[data-testid="create-spark-button"]');
    await page.fill('[data-testid="spark-title-input"]', sparkTitle);
    
    // Simulate network interruption
    await page.context().setOffline(true);
    await page.click('[data-testid="save-spark-button"]');
    
    // Should show offline indicator
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
    
    // Restore network
    await page.context().setOffline(false);
    
    // Retry save
    await page.click('[data-testid="save-spark-button"]');
    
    // Should succeed and show online indicator
    await expect(page.locator('[data-testid="online-indicator"]')).toBeVisible();
    await expect(page.locator(`[data-testid*="spark"][data-testid*="${sparkTitle}"]`))
      .toBeVisible();
  });

  test('should detect performance issues in task operations', async ({ page }) => {
    // Check for infinite loops during bulk operations
    const hasInfiniteLoop = await performanceHelper.checkForInfiniteLoops(5000);
    expect(hasInfiniteLoop).toBe(false);
    
    // Monitor memory usage during intensive operations
    const initialMemory = await performanceHelper.getMemoryUsage();
    
    // Perform multiple operations
    for (let i = 0; i < 5; i++) {
      await sparkHelper.createSpark(`Batch Spark ${i}`, `Description ${i}`);
    }
    
    const finalMemory = await performanceHelper.getMemoryUsage();
    
    if (initialMemory && finalMemory) {
      const memoryIncrease = finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize;
      // Memory increase should be reasonable (less than 10MB for 5 sparks)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    }
    
    // Wait for performance to stabilize
    const isStable = await performanceHelper.waitForStablePerformance(5000);
    expect(isStable).toBe(true);
  });

  test('should handle boundary conditions for spark operations', async ({ page }) => {
    // Test maximum title length
    const longTitle = 'A'.repeat(1000);
    await sparkHelper.createSpark(longTitle);
    
    // Title should be truncated or validation should prevent it
    const createdSpark = page.locator(`[data-testid*="spark"][data-testid*="${longTitle.substring(0, 50)}"]`);
    const isVisible = await createdSpark.isVisible().catch(() => false);
    
    if (!isVisible) {
      // Should show validation error
      await expect(page.locator('[data-testid="title-length-error"]')).toBeVisible();
    }
    
    // Test empty content handling
    await sparkHelper.createSpark('Empty Content Test', '', '');
    await expect(page.locator(`[data-testid*="spark"][data-testid*="Empty Content Test"]`))
      .toBeVisible();
    
    // Test special characters in titles
    const specialTitle = '特殊字符🎉<script>alert("test")</script>';
    await sparkHelper.createSpark(specialTitle);
    
    // Should handle special characters safely
    const specialSpark = page.locator(`[data-testid*="spark"][data-testid*="特殊字符"]`);
    await expect(specialSpark).toBeVisible();
  });
});