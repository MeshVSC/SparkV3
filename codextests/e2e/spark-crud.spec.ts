import { test, expect } from '@playwright/test'

const makeTitle = (label: string) => `${label} ${Date.now()}`

test.describe('Spark CRUD sanity (guest UI)', () => {
  test('guest user can create, edit, and delete a spark from the main flow', async ({ page }) => {
    const initialTitle = makeTitle('Playwright Spark')
    const updatedTitle = `${initialTitle} Updated`
    const description = 'Created via Playwright automation to validate spark flows.'

    await page.goto('/app')

    // CREATE: use the primary New Spark button exposed on the sidebar.
    const newSparkButton = page.getByRole('button', { name: 'New Spark', exact: true }).first()
    await newSparkButton.waitFor({ state: 'visible' })
    await newSparkButton.click()

    const createDialog = page.locator('.mantine-Modal-root').first()
    await createDialog.waitFor({ state: 'visible' })
    await createDialog.getByLabel('Title *').fill(initialTitle)
    await createDialog.getByLabel('Description').fill(description)
    await createDialog.getByRole('button', { name: 'Create Spark', exact: true }).click()
    await createDialog.waitFor({ state: 'hidden' })

    // Switch to Kanban view to verify and continue CRUD interactions in a structured layout.
    await page.getByRole('button', { name: /^Kanban$/ }).first().click()
    const main = page.locator('main')
    await expect(page.getByRole('heading', { name: 'Kanban Board' })).toBeVisible()

    const createdCard = main.locator('.kanban-card').filter({ hasText: initialTitle }).first()
    await expect(createdCard).toBeVisible()

    // EDIT: open the card menu, update title + status, and confirm change propagates.
    await createdCard.getByLabel('Spark options menu').click()
    await page.getByRole('menuitem', { name: 'Edit Details' }).click()

    const editDialog = page.getByRole('dialog', { name: 'Edit Spark Details' })
    await expect(editDialog).toBeVisible()
    await editDialog.getByLabel('Title *').fill(updatedTitle)
    await editDialog.getByRole('button', { name: 'Save Changes', exact: true }).click()

    const updatedCard = main.locator('.kanban-card').filter({ hasText: updatedTitle }).first()
    await expect(updatedCard).toBeVisible()

    // DELETE: remove the spark and ensure the card disappears from the board.
    await updatedCard.getByLabel('Spark options menu').click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await expect(main.locator('.kanban-card').filter({ hasText: updatedTitle })).toHaveCount(0)
  })
})
