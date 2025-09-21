import { test, expect } from '@playwright/test'

test.describe('View modes', () => {
  test('guest can toggle between canvas, kanban, and timeline views', async ({ page }) => {
    await page.goto('/app')

    // Canvas is default; confirm grid canvas rendered
    await expect(page.locator('[data-testid="canvas-view"]')).toBeVisible()

    await page.getByRole('button', { name: /^Kanban$/ }).first().click()
    await expect(page.getByRole('heading', { name: 'Kanban Board' })).toBeVisible()

    await page.getByRole('button', { name: /^Timeline$/ }).first().click()
    await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible()

    // Return to canvas via sidebar tab (Sparks)
    const sparksTab = page.getByRole('tab', { name: /Sparks/ })
    await sparksTab.click()
    await expect(page.locator('[data-testid="canvas-view"]')).toBeVisible()
  })
})
