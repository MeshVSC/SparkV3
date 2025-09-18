import { test, expect } from '../setup';

test.describe('Workspace Management', () => {
  test('creates workspace successfully', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/workspaces');
    
    await authenticatedPage.click('[data-testid="create-workspace-button"]');
    await authenticatedPage.fill('[data-testid="workspace-name-input"]', 'Test Workspace');
    await authenticatedPage.fill('[data-testid="workspace-description-input"]', 'Test Description');
    await authenticatedPage.click('[data-testid="create-workspace-submit"]');

    await expect(authenticatedPage.locator('text=Test Workspace')).toBeVisible();
  });

  test('joins existing workspace', async ({ browser, testUsers }) => {
    const [context1, context2] = await Promise.all([
      browser.newContext(),
      browser.newContext()
    ]);

    const [page1, page2] = await Promise.all([
      context1.newPage(),
      context2.newPage()
    ]);

    // Login as admin
    await page1.goto('/auth/signin');
    await page1.fill('input[name="email"]', testUsers[0].email);
    await page1.fill('input[name="password"]', testUsers[0].password);
    await page1.click('button[type="submit"]');
    await page1.waitForURL('/dashboard');

    // Create workspace
    await page1.goto('/workspaces');
    await page1.click('[data-testid="create-workspace-button"]');
    await page1.fill('[data-testid="workspace-name-input"]', 'Shared Workspace');
    await page1.click('[data-testid="create-workspace-submit"]');

    // Login as regular user
    await page2.goto('/auth/signin');
    await page2.fill('input[name="email"]', testUsers[1].email);
    await page2.fill('input[name="password"]', testUsers[1].password);
    await page2.click('button[type="submit"]');
    await page2.waitForURL('/dashboard');

    // Join workspace
    await page2.goto('/workspaces');
    await page2.click('[data-testid="browse-workspaces"]');
    await page2.click('text=Shared Workspace');
    await page2.click('[data-testid="join-workspace-button"]');

    await expect(page2.locator('text=Successfully joined workspace')).toBeVisible();

    await Promise.all([context1.close(), context2.close()]);
  });

  test('enforces user permissions', async ({ browser, testUsers }) => {
    const [adminContext, userContext] = await Promise.all([
      browser.newContext(),
      browser.newContext()
    ]);

    const [adminPage, userPage] = await Promise.all([
      adminContext.newPage(),
      userContext.newPage()
    ]);

    // Setup admin user
    await adminPage.goto('/auth/signin');
    await adminPage.fill('input[name="email"]', testUsers[0].email);
    await adminPage.fill('input[name="password"]', testUsers[0].password);
    await adminPage.click('button[type="submit"]');

    // Setup regular user
    await userPage.goto('/auth/signin');
    await userPage.fill('input[name="email"]', testUsers[1].email);
    await userPage.fill('input[name="password"]', testUsers[1].password);
    await userPage.click('button[type="submit"]');

    // Admin should see admin controls
    await adminPage.goto('/workspaces/test-workspace');
    await expect(adminPage.locator('[data-testid="admin-controls"]')).toBeVisible();
    await expect(adminPage.locator('[data-testid="delete-workspace"]')).toBeVisible();

    // Regular user should not see admin controls
    await userPage.goto('/workspaces/test-workspace');
    await expect(userPage.locator('[data-testid="admin-controls"]')).not.toBeVisible();
    await expect(userPage.locator('[data-testid="delete-workspace"]')).not.toBeVisible();

    await Promise.all([adminContext.close(), userContext.close()]);
  });

  test('handles leaving workspace', async ({ browser, testUsers }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/auth/signin');
    await page.fill('input[name="email"]', testUsers[1].email);
    await page.fill('input[name="password"]', testUsers[1].password);
    await page.click('button[type="submit"]');

    await page.goto('/workspaces/test-workspace');
    await page.click('[data-testid="workspace-menu"]');
    await page.click('[data-testid="leave-workspace"]');
    await page.click('[data-testid="confirm-leave"]');

    await expect(page).toHaveURL('/workspaces');
    await expect(page.locator('text=You have left the workspace')).toBeVisible();

    await context.close();
  });

  test('prevents unauthorized access', async ({ browser, testUsers }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Try to access workspace without login
    await page.goto('/workspaces/private-workspace');
    await expect(page).toHaveURL('/auth/signin');

    // Login as user without access
    await page.fill('input[name="email"]', testUsers[2].email);
    await page.fill('input[name="password"]', testUsers[2].password);
    await page.click('button[type="submit"]');

    await page.goto('/workspaces/private-workspace');
    await expect(page.locator('text=Access denied')).toBeVisible();

    await context.close();
  });
});