import { test, expect } from '@playwright/test'

test.describe('Onboarding experience', () => {
  test('landing page highlights Spark value proposition and CTA', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Spark' })).toBeVisible()
    await expect(page.getByText('Capture every spark.', { exact: false })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible()
  })
})
