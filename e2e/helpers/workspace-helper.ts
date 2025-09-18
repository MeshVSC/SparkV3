import { Page, expect } from '@playwright/test';
import { TEST_WORKSPACES } from '../fixtures/test-data';

export class WorkspaceHelper {
  constructor(private page: Page) {}

  async switchToWorkspace(workspaceKey: keyof typeof TEST_WORKSPACES) {
    const workspace = TEST_WORKSPACES[workspaceKey];
    
    // Open workspace selector
    await this.page.click('[data-testid="workspace-selector"]');
    
    // Select the workspace
    await this.page.click(`[data-testid="workspace-option-${workspace.id}"]`);
    
    // Wait for workspace to load
    await expect(this.page.locator('[data-testid="workspace-title"]')).toContainText(workspace.name);
    
    return workspace;
  }

  async createWorkspace(name: string, description?: string) {
    await this.page.click('[data-testid="create-workspace-button"]');
    
    await this.page.fill('[data-testid="workspace-name-input"]', name);
    if (description) {
      await this.page.fill('[data-testid="workspace-description-input"]', description);
    }
    
    await this.page.click('[data-testid="create-workspace-confirm"]');
    
    // Wait for creation to complete
    await expect(this.page.locator('[data-testid="workspace-title"]')).toContainText(name);
    
    return { name, description };
  }

  async inviteUserToWorkspace(email: string, role: 'OWNER' | 'EDITOR' | 'VIEWER' = 'EDITOR') {
    await this.page.click('[data-testid="workspace-settings"]');
    await this.page.click('[data-testid="manage-members"]');
    
    await this.page.fill('[data-testid="invite-email-input"]', email);
    await this.page.selectOption('[data-testid="invite-role-select"]', role);
    await this.page.click('[data-testid="send-invite-button"]');
    
    // Wait for invitation confirmation
    await expect(this.page.locator('[data-testid="invite-sent-message"]')).toBeVisible();
  }

  async shareSparkToWorkspace(sparkId: string, workspaceKey: keyof typeof TEST_WORKSPACES) {
    const workspace = TEST_WORKSPACES[workspaceKey];
    
    // Right-click on spark to open context menu
    await this.page.click(`[data-testid="spark-${sparkId}"]`, { button: 'right' });
    
    // Click share option
    await this.page.click('[data-testid="context-share-spark"]');
    
    // Select target workspace
    await this.page.click(`[data-testid="share-workspace-${workspace.id}"]`);
    
    // Confirm share
    await this.page.click('[data-testid="confirm-share-button"]');
    
    // Wait for share confirmation
    await expect(this.page.locator('[data-testid="share-success-message"]')).toBeVisible();
  }

  async getWorkspaceMembers() {
    await this.page.click('[data-testid="workspace-settings"]');
    await this.page.click('[data-testid="manage-members"]');
    
    const members = await this.page.$$eval('[data-testid^="member-"]', (elements) => {
      return elements.map(el => ({
        name: el.querySelector('[data-testid="member-name"]')?.textContent || '',
        email: el.querySelector('[data-testid="member-email"]')?.textContent || '',
        role: el.querySelector('[data-testid="member-role"]')?.textContent || '',
      }));
    });
    
    return members;
  }

  async deleteWorkspace() {
    await this.page.click('[data-testid="workspace-settings"]');
    await this.page.click('[data-testid="danger-zone"]');
    await this.page.click('[data-testid="delete-workspace-button"]');
    
    // Confirm deletion
    await this.page.fill('[data-testid="delete-confirmation-input"]', 'DELETE');
    await this.page.click('[data-testid="confirm-delete-workspace"]');
    
    // Wait for redirect to workspace selection
    await this.page.waitForURL('/workspaces');
  }

  async verifyWorkspaceSync(sparkId: string, expectedTitle: string) {
    // Verify that changes are reflected in the workspace
    await this.page.reload();
    await this.page.waitForLoadState('networkidle');
    
    const sparkTitle = await this.page.locator(`[data-testid="spark-${sparkId}"] [data-testid="spark-title"]`).textContent();
    expect(sparkTitle).toBe(expectedTitle);
  }

  async waitForCollaborationUpdate(sparkId: string, timeoutMs: number = 10000) {
    // Wait for real-time collaboration updates
    return await this.page.waitForFunction(
      (sparkId) => {
        const element = document.querySelector(`[data-testid="spark-${sparkId}"]`);
        return element?.classList.contains('updated-by-collaborator');
      },
      sparkId,
      { timeout: timeoutMs }
    );
  }

  async simulateNetworkInterruption(durationMs: number = 3000) {
    // Simulate network offline
    await this.page.context().setOffline(true);
    
    // Wait for specified duration
    await this.page.waitForTimeout(durationMs);
    
    // Restore network
    await this.page.context().setOffline(false);
    
    // Wait for reconnection
    await this.page.waitForLoadState('networkidle');
  }

  async verifyOfflineIndicator() {
    await expect(this.page.locator('[data-testid="offline-indicator"]')).toBeVisible();
  }

  async verifyOnlineIndicator() {
    await expect(this.page.locator('[data-testid="online-indicator"]')).toBeVisible();
  }
}