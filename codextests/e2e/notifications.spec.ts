import { test, expect } from '@playwright/test'

test.describe('Notifications', () => {
  test('renders notification history UI for guests', async ({ page }) => {
    await page.goto('/app/notifications')

    await expect(page.getByRole('heading', { name: 'Notification History' })).toBeVisible()
    await expect(page.getByText('Manage your notifications and preferences')).toBeVisible()
  })
})
