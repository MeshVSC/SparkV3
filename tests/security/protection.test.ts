import { test, expect } from '../setup';

test.describe('Security Protection', () => {
  test('CSRF protection on forms', async ({ page, testUsers }) => {
    await page.goto('/auth/signin');
    
    // Try to submit form without CSRF token
    const response = await page.request.post('/api/auth/signin', {
      data: {
        email: testUsers[0].email,
        password: testUsers[0].password
      }
    });
    
    expect(response.status()).toBe(403);
  });

  test('rate limiting on login attempts', async ({ page }) => {
    await page.goto('/auth/signin');
    
    // Make multiple failed login attempts
    for (let i = 0; i < 6; i++) {
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(100);
    }

    // Should show rate limiting message
    await expect(page.locator('text=Too many attempts')).toBeVisible();
  });

  test('prevents unauthorized API access', async ({ page }) => {
    const endpoints = [
      '/api/user/profile',
      '/api/workspaces/create',
      '/api/sparks/create',
      '/api/admin/users'
    ];

    for (const endpoint of endpoints) {
      const response = await page.request.get(endpoint);
      expect(response.status()).toBe(401);
    }
  });

  test('validates role-based permissions', async ({ browser, testUsers }) => {
    const userContext = await browser.newContext();
    const userPage = await userContext.newPage();

    // Login as regular user
    await userPage.goto('/auth/signin');
    await userPage.fill('input[name="email"]', testUsers[1].email);
    await userPage.fill('input[name="password"]', testUsers[1].password);
    await userPage.click('button[type="submit"]');

    // Try to access admin endpoints
    const adminEndpoints = [
      '/api/admin/users',
      '/api/admin/workspaces',
      '/api/admin/system'
    ];

    for (const endpoint of adminEndpoints) {
      const response = await userPage.request.get(endpoint);
      expect(response.status()).toBe(403);
    }

    // Try to access admin pages
    await userPage.goto('/admin');
    await expect(userPage.locator('text=Access denied')).toBeVisible();

    await userContext.close();
  });

  test('sanitizes user input', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    
    // Try to create spark with XSS payload
    await authenticatedPage.click('[data-testid="create-spark"]');
    await authenticatedPage.fill('[data-testid="spark-title"]', '<script>alert("xss")</script>');
    await authenticatedPage.fill('[data-testid="spark-content"]', '<img src=x onerror=alert("xss")>');
    await authenticatedPage.click('[data-testid="save-spark"]');

    // Check that script tags are sanitized
    const sparkTitle = await authenticatedPage.locator('[data-testid="spark-title-display"]');
    await expect(sparkTitle).not.toContainText('<script>');
    
    const sparkContent = await authenticatedPage.locator('[data-testid="spark-content-display"]');
    await expect(sparkContent).not.toContainText('<img src=x onerror=');
  });

  test('validates file upload restrictions', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/profile');
    
    // Try to upload executable file
    await authenticatedPage.setInputFiles('[data-testid="avatar-upload"]', {
      name: 'malicious.exe',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('fake executable content')
    });

    await expect(authenticatedPage.locator('text=Invalid file type')).toBeVisible();
  });

  test('enforces content security policy', async ({ page }) => {
    await page.goto('/');
    
    // Check CSP headers
    const response = await page.request.get('/');
    const cspHeader = response.headers()['content-security-policy'];
    
    expect(cspHeader).toBeDefined();
    expect(cspHeader).toContain("script-src 'self'");
    expect(cspHeader).toContain("object-src 'none'");
  });

  test('prevents clickjacking', async ({ page }) => {
    const response = await page.request.get('/');
    const xFrameOptions = response.headers()['x-frame-options'];
    
    expect(xFrameOptions).toBe('DENY');
  });

  test('secure cookie settings', async ({ page, testUsers }) => {
    await page.goto('/auth/signin');
    await page.fill('input[name="email"]', testUsers[0].email);
    await page.fill('input[name="password"]', testUsers[0].password);
    await page.click('button[type="submit"]');

    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name.includes('session'));
    
    expect(sessionCookie?.httpOnly).toBe(true);
    expect(sessionCookie?.secure).toBe(true);
    expect(sessionCookie?.sameSite).toBe('Lax');
  });

  test('session timeout enforcement', async ({ page, testUsers }) => {
    await page.goto('/auth/signin');
    await page.fill('input[name="email"]', testUsers[0].email);
    await page.fill('input[name="password"]', testUsers[0].password);
    await page.click('button[type="submit"]');

    // Fast-forward time
    await page.evaluate(() => {
      const originalDate = Date;
      const mockDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours later
      (global as any).Date = jest.fn(() => mockDate);
    });

    await page.reload();
    await page.waitForURL('/auth/signin');
    await expect(page.locator('text=Session expired')).toBeVisible();
  });
});