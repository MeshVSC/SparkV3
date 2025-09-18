import { Page, expect } from '@playwright/test';
import { TEST_SPARKS } from '../fixtures/test-data';

export class SparkHelper {
  constructor(private page: Page) {}

  async createSpark(title: string, description?: string, content?: string) {
    // Click create new spark button
    await this.page.click('[data-testid="create-spark-button"]');
    
    // Fill spark details
    await this.page.fill('[data-testid="spark-title-input"]', title);
    
    if (description) {
      await this.page.fill('[data-testid="spark-description-input"]', description);
    }
    
    if (content) {
      await this.page.fill('[data-testid="spark-content-editor"]', content);
    }
    
    // Save spark
    await this.page.click('[data-testid="save-spark-button"]');
    
    // Wait for spark to appear in canvas
    await expect(this.page.locator(`[data-testid*="spark"][data-testid*="${title}"]`)).toBeVisible();
    
    return title;
  }

  async editSpark(sparkId: string, newTitle: string, newDescription?: string) {
    // Double-click to edit or right-click and select edit
    await this.page.dblclick(`[data-testid="spark-${sparkId}"]`);
    
    // Edit title
    await this.page.fill('[data-testid="spark-title-input"]', newTitle);
    
    if (newDescription) {
      await this.page.fill('[data-testid="spark-description-input"]', newDescription);
    }
    
    // Save changes
    await this.page.click('[data-testid="save-spark-button"]');
    
    // Verify changes are reflected
    await expect(this.page.locator(`[data-testid="spark-${sparkId}"] [data-testid="spark-title"]`))
      .toContainText(newTitle);
  }

  async deleteSpark(sparkId: string) {
    // Right-click on spark
    await this.page.click(`[data-testid="spark-${sparkId}"]`, { button: 'right' });
    
    // Click delete option
    await this.page.click('[data-testid="context-delete-spark"]');
    
    // Confirm deletion
    await this.page.click('[data-testid="confirm-delete-button"]');
    
    // Verify spark is removed
    await expect(this.page.locator(`[data-testid="spark-${sparkId}"]`)).not.toBeVisible();
  }

  async dragSparkToPosition(sparkId: string, x: number, y: number) {
    const sparkElement = this.page.locator(`[data-testid="spark-${sparkId}"]`);
    
    // Get current position
    const box = await sparkElement.boundingBox();
    if (!box) throw new Error('Spark element not found');
    
    // Drag to new position
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(x, y);
    await this.page.mouse.up();
    
    // Wait for position to update
    await this.page.waitForTimeout(500);
  }

  async changeSparkStatus(sparkId: string, status: 'SEEDLING' | 'SAPLING' | 'TREE' | 'FOREST') {
    // Right-click on spark
    await this.page.click(`[data-testid="spark-${sparkId}"]`, { button: 'right' });
    
    // Navigate to status submenu
    await this.page.hover('[data-testid="context-change-status"]');
    
    // Select new status
    await this.page.click(`[data-testid="status-${status.toLowerCase()}"]`);
    
    // Verify status change
    await expect(this.page.locator(`[data-testid="spark-${sparkId}"] [data-testid="spark-status"]`))
      .toContainText(status);
  }

  async addTagToSpark(sparkId: string, tag: string) {
    await this.page.dblclick(`[data-testid="spark-${sparkId}"]`);
    
    // Add tag
    await this.page.fill('[data-testid="spark-tags-input"]', tag);
    await this.page.press('[data-testid="spark-tags-input"]', 'Enter');
    
    // Save
    await this.page.click('[data-testid="save-spark-button"]');
    
    // Verify tag is added
    await expect(this.page.locator(`[data-testid="spark-${sparkId}"] [data-testid="spark-tag-${tag}"]`))
      .toBeVisible();
  }

  async connectSparks(sparkId1: string, sparkId2: string, connectionType: 'DEPENDS_ON' | 'RELATED_TO' | 'INSPIRES' | 'CONFLICTS_WITH') {
    // Select first spark
    await this.page.click(`[data-testid="spark-${sparkId1}"]`);
    
    // Hold Ctrl and select second spark
    await this.page.keyboard.down('Control');
    await this.page.click(`[data-testid="spark-${sparkId2}"]`);
    await this.page.keyboard.up('Control');
    
    // Right-click to open context menu
    await this.page.click(`[data-testid="spark-${sparkId2}"]`, { button: 'right' });
    
    // Select connection type
    await this.page.hover('[data-testid="context-create-connection"]');
    await this.page.click(`[data-testid="connection-${connectionType.toLowerCase()}"]`);
    
    // Verify connection is created
    await expect(this.page.locator(`[data-testid="connection-${sparkId1}-${sparkId2}"]`))
      .toBeVisible();
  }

  async bulkSelectSparks(sparkIds: string[]) {
    // Use Ctrl+click for multiple selection
    for (let i = 0; i < sparkIds.length; i++) {
      if (i === 0) {
        await this.page.click(`[data-testid="spark-${sparkIds[i]}"]`);
      } else {
        await this.page.keyboard.down('Control');
        await this.page.click(`[data-testid="spark-${sparkIds[i]}"]`);
        await this.page.keyboard.up('Control');
      }
    }
    
    // Verify all sparks are selected
    for (const sparkId of sparkIds) {
      await expect(this.page.locator(`[data-testid="spark-${sparkId}"]`))
        .toHaveClass(/selected/);
    }
    
    return sparkIds.length;
  }

  async bulkDeleteSparks(sparkIds: string[]) {
    await this.bulkSelectSparks(sparkIds);
    
    // Press Delete key
    await this.page.keyboard.press('Delete');
    
    // Confirm bulk deletion
    await this.page.click('[data-testid="confirm-bulk-delete"]');
    
    // Verify all sparks are deleted
    for (const sparkId of sparkIds) {
      await expect(this.page.locator(`[data-testid="spark-${sparkId}"]`)).not.toBeVisible();
    }
  }

  async bulkChangeStatus(sparkIds: string[], status: 'SEEDLING' | 'SAPLING' | 'TREE' | 'FOREST') {
    await this.bulkSelectSparks(sparkIds);
    
    // Right-click for context menu
    await this.page.click(`[data-testid="spark-${sparkIds[0]}"]`, { button: 'right' });
    
    // Navigate to bulk status change
    await this.page.hover('[data-testid="context-bulk-change-status"]');
    await this.page.click(`[data-testid="bulk-status-${status.toLowerCase()}"]`);
    
    // Verify status change for all sparks
    for (const sparkId of sparkIds) {
      await expect(this.page.locator(`[data-testid="spark-${sparkId}"] [data-testid="spark-status"]`))
        .toContainText(status);
    }
  }

  async selectAllSparks() {
    await this.page.keyboard.press('Control+a');
    
    // Count selected sparks
    const selectedSparks = await this.page.$$('[data-testid*="spark"].selected');
    return selectedSparks.length;
  }

  async copySelectedSparks() {
    await this.page.keyboard.press('Control+c');
    
    // Verify copy indicator
    await expect(this.page.locator('[data-testid="copy-indicator"]')).toBeVisible();
  }

  async pasteSparksCopies() {
    await this.page.keyboard.press('Control+v');
    
    // Wait for paste operation to complete
    await this.page.waitForTimeout(1000);
    
    // Count new sparks (should have "copy" in their titles)
    const copiedSparks = await this.page.$$('[data-testid*="spark"][data-testid*="copy"]');
    return copiedSparks.length;
  }

  async searchSparks(query: string) {
    // Open search
    await this.page.keyboard.press('Control+f');
    
    // Type search query
    await this.page.fill('[data-testid="search-input"]', query);
    
    // Wait for search results
    await this.page.waitForSelector('[data-testid="search-results"]');
    
    // Count visible results
    const results = await this.page.$$('[data-testid*="spark"]:visible');
    return results.length;
  }

  async filterSparksByTag(tag: string) {
    await this.page.click('[data-testid="filter-dropdown"]');
    await this.page.click(`[data-testid="filter-tag-${tag}"]`);
    
    // Wait for filter to apply
    await this.page.waitForTimeout(500);
    
    const visibleSparks = await this.page.$$('[data-testid*="spark"]:visible');
    return visibleSparks.length;
  }

  async exportSparks(format: 'JSON' | 'CSV' | 'PDF') {
    await this.page.click('[data-testid="export-button"]');
    await this.page.click(`[data-testid="export-${format.toLowerCase()}"]`);
    
    // Wait for download to start
    const downloadPromise = this.page.waitForEvent('download');
    await this.page.click('[data-testid="confirm-export"]');
    const download = await downloadPromise;
    
    return {
      filename: download.suggestedFilename(),
      path: await download.path(),
    };
  }

  async importSparks(filePath: string) {
    await this.page.click('[data-testid="import-button"]');
    
    // Upload file
    const fileInput = this.page.locator('[data-testid="import-file-input"]');
    await fileInput.setInputFiles(filePath);
    
    // Confirm import
    await this.page.click('[data-testid="confirm-import"]');
    
    // Wait for import to complete
    await expect(this.page.locator('[data-testid="import-success"]')).toBeVisible();
    
    // Count imported sparks
    const sparks = await this.page.$$('[data-testid*="spark"]');
    return sparks.length;
  }
}