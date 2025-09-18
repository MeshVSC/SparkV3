import { test, expect } from '../setup';

test.describe('Authentication Flow', () => {
  test('successful login flow', async ({ page, testUsers }) => {
    await page.goto('/auth/signin');
    
    await page.fill('input[name="email"]', testUsers[0].email);
    await page.fill('input[name="password"]', testUsers[0].password);
    await page.click('button[type="submit"]');

    await page.waitForURL('/dashboard');
    await expect(page.locator('text=Welcome back')).toBeVisible();
  });

  test('handles invalid credentials', async ({ page }) => {
    await page.goto('/auth/signin');
    
    await page.fill('input[name="email"]', 'invalid@test.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Invalid credentials')).toBeVisible();
    await expect(page).toHaveURL('/auth/signin');
  });

  test('logout functionality', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="user-menu"]');
    await authenticatedPage.click('[data-testid="logout-button"]');

    await authenticatedPage.waitForURL('/auth/signin');
    await expect(authenticatedPage.locator('text=Sign in')).toBeVisible();
  });

  test('session persistence across page reloads', async ({ authenticatedPage }) => {
    await authenticatedPage.reload();
    await authenticatedPage.waitForLoadState('networkidle');
    
    await expect(authenticatedPage).toHaveURL('/dashboard');
    await expect(authenticatedPage.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('session expiration handling', async ({ page, testUsers }) => {
    await page.goto('/auth/signin');
    await page.fill('input[name="email"]', testUsers[0].email);
    await page.fill('input[name="password"]', testUsers[0].password);
    await page.click('button[type="submit"]');

    // Simulate expired session
    await page.evaluate(() => {
      document.cookie = 'next-auth.session-token=expired; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    });

    await page.goto('/dashboard');
    await page.waitForURL('/auth/signin');
    await expect(page.locator('text=Session expired')).toBeVisible();
  });

  test('token validation on protected routes', async ({ page }) => {
    // Access protected route without authentication
    await page.goto('/dashboard');
    await page.waitForURL('/auth/signin');

    // Access API route without authentication
    const response = await page.request.get('/api/user/profile');
    expect(response.status()).toBe(401);
  });

  test('remembers redirect after login', async ({ page, testUsers }) => {
    // Try to access protected page
    await page.goto('/workspaces/private-workspace');
    await page.waitForURL('/auth/signin');

    // Login
    await page.fill('input[name="email"]', testUsers[0].email);
    await page.fill('input[name="password"]', testUsers[0].password);
    await page.click('button[type="submit"]');

    // Should redirect to original page
    await page.waitForURL('/workspaces/private-workspace');
  });

  test('handles concurrent login attempts', async ({ browser, testUsers }) => {
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext()
    ]);

    const pages = await Promise.all(contexts.map(ctx => ctx.newPage()));

    await Promise.all(pages.map(async (page, i) => {
      await page.goto('/auth/signin');
      await page.fill('input[name="email"]', testUsers[0].email);
      await page.fill('input[name="password"]', testUsers[0].password);
      await page.click('button[type="submit"]');
      
      if (i === 0) {
        await page.waitForURL('/dashboard');
      }
    }));

    // First login should succeed, second should handle gracefully
    await expect(pages[0]).toHaveURL('/dashboard');

    await Promise.all(contexts.map(ctx => ctx.close()));
  });
});