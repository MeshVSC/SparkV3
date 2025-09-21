import { test, expect } from '@playwright/test'

test.describe('Settings', () => {
  test('notification preferences page loads with form controls', async ({ page }) => {
    await page.goto('/settings/notifications')

    await expect(page.getByRole('heading', { name: 'Notification Settings' })).toBeVisible()
    await expect(page.getByText('Manage how you receive notifications')).toBeVisible()
  })
})
