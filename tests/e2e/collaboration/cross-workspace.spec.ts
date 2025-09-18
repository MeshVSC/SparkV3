import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth-helper';
import { WorkspaceHelper } from '../helpers/workspace-helper';
import { SparkHelper } from '../helpers/spark-helper';
import { PerformanceHelper } from '../helpers/performance-helper';
import { TEST_USERS, TEST_WORKSPACES, TEST_SPARKS } from '../fixtures/test-data';

test.describe('Cross-Workspace Collaboration', () => {
  let authHelper: AuthHelper;
  let workspaceHelper: WorkspaceHelper;
  let sparkHelper: SparkHelper;
  let performanceHelper: PerformanceHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    workspaceHelper = new WorkspaceHelper(page);
    sparkHelper = new SparkHelper(page);
    performanceHelper = new PerformanceHelper(page);
    
    await performanceHelper.startMeasurement();
    await authHelper.loginWithSession('USER1');
  });

  test.afterEach(async () => {
    const report = await performanceHelper.generatePerformanceReport();
    if (report.consoleErrors > 2) {
      console.warn('High console error count:', report.consoleErrorDetails);
    }
  });

  test('should share sparks between workspaces', async ({ page }) => {
    // Start in primary workspace
    await workspaceHelper.switchToWorkspace('PRIMARY');
    
    // Share a spark to collaboration workspace
    await workspaceHelper.shareSparkToWorkspace(TEST_SPARKS.SEEDLING.id, 'COLLABORATION');
    
    // Switch to collaboration workspace
    await workspaceHelper.switchToWorkspace('COLLABORATION');
    
    // Verify spark is now visible in collaboration workspace
    await expect(page.locator(`[data-testid="spark-${TEST_SPARKS.SEEDLING.id}"]`))
      .toBeVisible();
    
    // Verify shared indicator
    await expect(page.locator(`[data-testid="spark-${TEST_SPARKS.SEEDLING.id}"] [data-testid="shared-indicator"]`))
      .toBeVisible();
  });

  test('should handle real-time collaboration updates', async ({ page, context }) => {
    // Open second browser tab as User 2
    const secondTab = await context.newPage();
    const secondAuthHelper = new AuthHelper(secondTab);
    const secondSparkHelper = new SparkHelper(secondTab);
    const secondWorkspaceHelper = new WorkspaceHelper(secondTab);
    
    // Login as second user
    await secondAuthHelper.loginWithSession('USER2');
    await secondWorkspaceHelper.switchToWorkspace('COLLABORATION');
    
    // Both users in same workspace, edit shared spark simultaneously
    await workspaceHelper.switchToWorkspace('COLLABORATION');
    
    const originalTitle = 'Shared Collaboration Spark';
    const user1Edit = 'Edited by User 1';
    const user2Edit = 'Edited by User 2';
    
    // User 1 starts editing
    await sparkHelper.editSpark(TEST_SPARKS.SHARED.id, user1Edit);
    
    // User 2 should see the update in real-time
    await secondTab.waitForFunction(
      (sparkId, expectedTitle) => {
        const element = document.querySelector(`[data-testid="spark-${sparkId}"] [data-testid="spark-title"]`);
        return element && element.textContent?.includes(expectedTitle);
      },
      TEST_SPARKS.SHARED.id,
      user1Edit,
      { timeout: 5000 }
    );
    
    // User 2 makes another edit
    await secondSparkHelper.editSpark(TEST_SPARKS.SHARED.id, user2Edit);
    
    // User 1 should see User 2's edit
    await page.waitForFunction(
      (sparkId, expectedTitle) => {
        const element = document.querySelector(`[data-testid="spark-${sparkId}"] [data-testid="spark-title"]`);
        return element && element.textContent?.includes(expectedTitle);
      },
      TEST_SPARKS.SHARED.id,
      user2Edit,
      { timeout: 5000 }
    );
    
    await secondTab.close();
  });

  test('should handle concurrent editing conflicts', async ({ page, context }) => {
    const secondTab = await context.newPage();
    const secondAuthHelper = new AuthHelper(secondTab);
    const secondSparkHelper = new SparkHelper(secondTab);
    const secondWorkspaceHelper = new WorkspaceHelper(secondTab);
    
    await secondAuthHelper.loginWithSession('USER2');
    await secondWorkspaceHelper.switchToWorkspace('COLLABORATION');
    await workspaceHelper.switchToWorkspace('COLLABORATION');
    
    // Both users edit the same spark simultaneously
    const user1Title = 'User 1 Concurrent Edit';
    const user2Title = 'User 2 Concurrent Edit';
    
    // Start editing from both tabs at the same time
    await Promise.all([
      page.dblclick(`[data-testid="spark-${TEST_SPARKS.SHARED.id}"]`),
      secondTab.dblclick(`[data-testid="spark-${TEST_SPARKS.SHARED.id}"]`)
    ]);
    
    // Both users make changes
    await Promise.all([
      page.fill('[data-testid="spark-title-input"]', user1Title),
      secondTab.fill('[data-testid="spark-title-input"]', user2Title)
    ]);
    
    // Both try to save
    await Promise.all([
      page.click('[data-testid="save-spark-button"]'),
      secondTab.click('[data-testid="save-spark-button"]')
    ]);
    
    // Should show conflict resolution
    const hasConflictIndicator = await page.locator('[data-testid="conflict-indicator"]').isVisible({ timeout: 3000 })
      .catch(() => false);
    
    const hasSecondTabConflict = await secondTab.locator('[data-testid="conflict-indicator"]').isVisible({ timeout: 3000 })
      .catch(() => false);
    
    // At least one tab should show conflict resolution UI
    expect(hasConflictIndicator || hasSecondTabConflict).toBe(true);
    
    await secondTab.close();
  });

  test('should maintain workspace permissions', async ({ page, context }) => {
    // Create new workspace as owner
    await workspaceHelper.createWorkspace('Permission Test Workspace', 'Testing permissions');
    
    // Invite User 2 as viewer
    await workspaceHelper.inviteUserToWorkspace(TEST_USERS.USER2.email, 'VIEWER');
    
    // Login as User 2 in second tab
    const secondTab = await context.newPage();
    const secondAuthHelper = new AuthHelper(secondTab);
    const secondSparkHelper = new SparkHelper(secondTab);
    
    await secondAuthHelper.loginWithSession('USER2');
    
    // User 2 should see the workspace but have limited permissions
    const members = await workspaceHelper.getWorkspaceMembers();
    const user2Member = members.find(m => m.email === TEST_USERS.USER2.email);
    expect(user2Member?.role).toBe('VIEWER');
    
    // User 2 should not be able to edit sparks
    await secondTab.goto('/dashboard'); // Navigate to workspace
    
    const editButton = secondTab.locator('[data-testid="edit-spark-button"]');
    const isEditDisabled = await editButton.isDisabled().catch(() => true);
    expect(isEditDisabled).toBe(true);
    
    await secondTab.close();
  });

  test('should handle workspace member management', async ({ page }) => {
    await workspaceHelper.switchToWorkspace('COLLABORATION');
    
    // Get initial member count
    const initialMembers = await workspaceHelper.getWorkspaceMembers();
    const initialCount = initialMembers.length;
    
    // Invite new member
    const newMemberEmail = `newmember-${Date.now()}@test.com`;
    await workspaceHelper.inviteUserToWorkspace(newMemberEmail, 'EDITOR');
    
    // Verify invitation was sent
    await expect(page.locator('[data-testid="invite-sent-message"]')).toBeVisible();
    
    // Check member list updated
    const updatedMembers = await workspaceHelper.getWorkspaceMembers();
    expect(updatedMembers.length).toBe(initialCount + 1);
    
    const newMember = updatedMembers.find(m => m.email === newMemberEmail);
    expect(newMember?.role).toBe('EDITOR');
  });

  test('should sync changes across workspaces', async ({ page }) => {
    // Edit spark in primary workspace
    await workspaceHelper.switchToWorkspace('PRIMARY');
    
    const newTitle = `Synced Title ${Date.now()}`;
    await sparkHelper.editSpark(TEST_SPARKS.SEEDLING.id, newTitle);
    
    // Share to collaboration workspace
    await workspaceHelper.shareSparkToWorkspace(TEST_SPARKS.SEEDLING.id, 'COLLABORATION');
    
    // Switch to collaboration workspace
    await workspaceHelper.switchToWorkspace('COLLABORATION');
    
    // Verify changes are synced
    await workspaceHelper.verifyWorkspaceSync(TEST_SPARKS.SEEDLING.id, newTitle);
  });

  test('should handle network interruptions during collaboration', async ({ page, context }) => {
    const secondTab = await context.newPage();
    const secondAuthHelper = new AuthHelper(secondTab);
    const secondSparkHelper = new SparkHelper(secondTab);
    const secondWorkspaceHelper = new WorkspaceHelper(secondTab);
    
    await secondAuthHelper.loginWithSession('USER2');
    await secondWorkspaceHelper.switchToWorkspace('COLLABORATION');
    await workspaceHelper.switchToWorkspace('COLLABORATION');
    
    // Simulate network interruption on User 1's tab
    await workspaceHelper.simulateNetworkInterruption(3000);
    
    // During interruption, User 2 makes changes
    const offlineEdit = 'Edit during network interruption';
    await secondSparkHelper.editSpark(TEST_SPARKS.SHARED.id, offlineEdit);
    
    // User 1 should see offline indicator
    await workspaceHelper.verifyOfflineIndicator();
    
    // When network returns, User 1 should receive updates
    await workspaceHelper.verifyOnlineIndicator();
    
    // Wait for sync to complete
    await workspaceHelper.waitForCollaborationUpdate(TEST_SPARKS.SHARED.id, 10000);
    
    // Verify User 1 received User 2's changes
    await expect(page.locator(`[data-testid="spark-${TEST_SPARKS.SHARED.id}"] [data-testid="spark-title"]`))
      .toContainText(offlineEdit);
    
    await secondTab.close();
  });

  test('should handle bulk operations in collaborative environment', async ({ page, context }) => {
    const secondTab = await context.newPage();
    const secondAuthHelper = new AuthHelper(secondTab);
    const secondSparkHelper = new SparkHelper(secondTab);
    const secondWorkspaceHelper = new WorkspaceHelper(secondTab);
    
    await secondAuthHelper.loginWithSession('USER2');
    await secondWorkspaceHelper.switchToWorkspace('COLLABORATION');
    await workspaceHelper.switchToWorkspace('COLLABORATION');
    
    // User 1 performs bulk operation
    const sparkIds = [TEST_SPARKS.SEEDLING.id, TEST_SPARKS.SHARED.id];
    await sparkHelper.bulkSelectSparks(sparkIds);
    await sparkHelper.bulkChangeStatus(sparkIds, 'SAPLING');
    
    // User 2 should see the bulk changes in real-time
    for (const sparkId of sparkIds) {
      await secondTab.waitForFunction(
        (sparkId) => {
          const element = document.querySelector(`[data-testid="spark-${sparkId}"] [data-testid="spark-status"]`);
          return element && element.textContent?.includes('SAPLING');
        },
        sparkId,
        { timeout: 5000 }
      );
    }
    
    await secondTab.close();
  });

  test('should track collaboration performance', async ({ page, context }) => {
    const secondTab = await context.newPage();
    const secondAuthHelper = new AuthHelper(secondTab);
    const secondWorkspaceHelper = new WorkspaceHelper(secondTab);
    
    await secondAuthHelper.loginWithSession('USER2');
    await secondWorkspaceHelper.switchToWorkspace('COLLABORATION');
    await workspaceHelper.switchToWorkspace('COLLABORATION');
    
    // Measure real-time update performance
    const startTime = Date.now();
    
    // User 1 makes change
    const testTitle = `Performance Test ${Date.now()}`;
    await sparkHelper.editSpark(TEST_SPARKS.SHARED.id, testTitle);
    
    // Measure how long it takes for User 2 to see the change
    await secondTab.waitForFunction(
      (sparkId, expectedTitle) => {
        const element = document.querySelector(`[data-testid="spark-${sparkId}"] [data-testid="spark-title"]`);
        return element && element.textContent?.includes(expectedTitle);
      },
      TEST_SPARKS.SHARED.id,
      testTitle,
      { timeout: 10000 }
    );
    
    const syncTime = Date.now() - startTime;
    expect(syncTime).toBeLessThan(3000); // Should sync within 3 seconds
    
    console.log(`Collaboration sync time: ${syncTime}ms`);
    
    // Check memory usage on both tabs
    const user1Memory = await performanceHelper.getMemoryUsage();
    const user2Memory = await secondTab.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return null;
    });
    
    if (user1Memory && user2Memory) {
      expect(user1Memory.usedJSHeapSize).toBeLessThan(80 * 1024 * 1024); // Less than 80MB
      expect(user2Memory).toBeLessThan(80 * 1024 * 1024);
    }
    
    await secondTab.close();
  });

  test('should handle workspace deletion safely', async ({ page }) => {
    // Create temporary workspace
    await workspaceHelper.createWorkspace('Temporary Workspace', 'Will be deleted');
    
    // Add some content
    await sparkHelper.createSpark('Temporary Spark', 'This will be deleted with workspace');
    
    // Delete workspace
    await workspaceHelper.deleteWorkspace();
    
    // Should be redirected to workspace selection
    await expect(page).toHaveURL('/workspaces');
    
    // Verify workspace is no longer available
    const workspaceOptions = await page.$$('[data-testid^="workspace-option-"]');
    const hasDeletedWorkspace = await Promise.all(
      workspaceOptions.map(async (option) => {
        const text = await option.textContent();
        return text?.includes('Temporary Workspace');
      })
    );
    
    expect(hasDeletedWorkspace.includes(true)).toBe(false);
  });

  test('should detect collaboration edge cases', async ({ page, context }) => {
    const secondTab = await context.newPage();
    const secondAuthHelper = new AuthHelper(secondTab);
    const secondWorkspaceHelper = new WorkspaceHelper(secondTab);
    
    await secondAuthHelper.loginWithSession('USER2');
    await secondWorkspaceHelper.switchToWorkspace('COLLABORATION');
    await workspaceHelper.switchToWorkspace('COLLABORATION');
    
    // Test rapid concurrent edits
    const rapidEdits = 10;
    const promises = [];
    
    for (let i = 0; i < rapidEdits; i++) {
      if (i % 2 === 0) {
        promises.push(sparkHelper.editSpark(TEST_SPARKS.SHARED.id, `User1 Edit ${i}`));
      } else {
        promises.push(secondTab.evaluate((sparkId, title) => {
          // Simulate rapid edit from second user
          const titleElement = document.querySelector(`[data-testid="spark-${sparkId}"] [data-testid="spark-title"]`);
          if (titleElement) {
            titleElement.textContent = title;
            // Trigger change event
            titleElement.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, TEST_SPARKS.SHARED.id, `User2 Edit ${i}`));
      }
      
      await page.waitForTimeout(100); // Small delay between edits
    }
    
    await Promise.allSettled(promises);
    
    // Check that system handled rapid edits without crashing
    const isPageResponsive = await page.locator('[data-testid="main-canvas"]').isVisible();
    expect(isPageResponsive).toBe(true);
    
    const isSecondTabResponsive = await secondTab.locator('[data-testid="main-canvas"]').isVisible();
    expect(isSecondTabResponsive).toBe(true);
    
    // Check for console errors
    const consoleErrors = await performanceHelper.getConsoleErrors();
    expect(consoleErrors.length).toBeLessThan(5); // Allow some errors during rapid edits
    
    await secondTab.close();
  });
});