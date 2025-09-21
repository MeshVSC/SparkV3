import { test, expect } from '@playwright/test'

test.describe('Analytics & stats', () => {
  test('stats tab summarises totals for guest data', async ({ page }) => {
    await page.goto('/app')

    await page.getByRole('tab', { name: /Stats/ }).click()
    await expect(page.getByText('Your Progress')).toBeVisible()
    await expect(page.getByText('Total Sparks')).toBeVisible()
    await expect(page.getByText('Total XP')).toBeVisible()
  })
})
