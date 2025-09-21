import { test, expect } from '@playwright/test'

test.describe('UI interactions', () => {
  test('core sidebar controls respond to user actions', async ({ page }) => {
    await page.goto('/app')

    const searchInput = page.getByPlaceholder('Search sparks, todos, content...')
    await searchInput.fill('Prototype')
    await expect(searchInput).toHaveValue('Prototype')

    await page.getByRole('button', { name: 'Search Settings' }).click()
    await expect(page.getByText('Search Settings')).toBeVisible()
    await page.keyboard.press('Escape')

    const newSparkButton = page.getByRole('button', { name: 'New Spark', exact: true }).first()
    await newSparkButton.click()
    await expect(page.getByRole('dialog', { name: 'Create New Spark' })).toBeVisible()
    await page.keyboard.press('Escape')

    await page.getByRole('tab', { name: /Views/ }).click()
    await expect(page.getByText('Kanban Board', { exact: false })).toBeVisible()
  })
})
