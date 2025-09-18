import { test, expect } from '@playwright/test'

test.describe('Sparks Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Assume we need to be authenticated for sparks
    // This would use the auth setup if required
  })

  test('should create a new spark', async ({ page }) => {
    // Navigate to sparks page or click create button
    const createButton = page.getByRole('button', { name: /create.*spark/i })
    
    // Check if create button exists, if not, navigate to sparks page first
    const createButtonCount = await createButton.count()
    if (createButtonCount === 0) {
      await page.getByRole('link', { name: /sparks/i }).click()
    }
    
    // Click create spark button
    await page.getByRole('button', { name: /create.*spark/i }).click()
    
    // Fill in spark details
    await page.getByLabel('Title').fill('Test Spark E2E')
    await page.getByLabel('Description').fill('This is a test spark created via E2E testing')
    
    // Submit the form
    await page.getByRole('button', { name: /save|create/i }).click()
    
    // Verify the spark was created
    await expect(page.getByText('Test Spark E2E')).toBeVisible()
  })

  test('should edit an existing spark', async ({ page }) => {
    // First ensure we have a spark to edit (create one if needed)
    await test.step('Create a spark to edit', async () => {
      await page.goto('/') // Reset
      const createButton = page.getByRole('button', { name: /create.*spark/i })
      const createButtonCount = await createButton.count()
      
      if (createButtonCount === 0) {
        await page.getByRole('link', { name: /sparks/i }).click()
      }
      
      await page.getByRole('button', { name: /create.*spark/i }).click()
      await page.getByLabel('Title').fill('Spark to Edit')
      await page.getByLabel('Description').fill('This spark will be edited')
      await page.getByRole('button', { name: /save|create/i }).click()
    })

    // Now edit the spark
    await test.step('Edit the spark', async () => {
      await page.getByText('Spark to Edit').click()
      await page.getByRole('button', { name: /edit/i }).click()
      
      await page.getByLabel('Title').fill('Edited Spark Title')
      await page.getByLabel('Description').fill('This spark has been edited via E2E testing')
      
      await page.getByRole('button', { name: /save|update/i }).click()
      
      // Verify the changes
      await expect(page.getByText('Edited Spark Title')).toBeVisible()
      await expect(page.getByText('This spark has been edited via E2E testing')).toBeVisible()
    })
  })

  test('should delete a spark', async ({ page }) => {
    // First create a spark to delete
    await test.step('Create a spark to delete', async () => {
      await page.goto('/')
      const createButton = page.getByRole('button', { name: /create.*spark/i })
      const createButtonCount = await createButton.count()
      
      if (createButtonCount === 0) {
        await page.getByRole('link', { name: /sparks/i }).click()
      }
      
      await page.getByRole('button', { name: /create.*spark/i }).click()
      await page.getByLabel('Title').fill('Spark to Delete')
      await page.getByLabel('Description').fill('This spark will be deleted')
      await page.getByRole('button', { name: /save|create/i }).click()
    })

    // Delete the spark
    await test.step('Delete the spark', async () => {
      await page.getByText('Spark to Delete').click()
      await page.getByRole('button', { name: /delete/i }).click()
      
      // Confirm deletion if there's a confirmation dialog
      const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i })
      const confirmCount = await confirmButton.count()
      if (confirmCount > 0) {
        await confirmButton.click()
      }
      
      // Verify the spark is no longer visible
      await expect(page.getByText('Spark to Delete')).not.toBeVisible()
    })
  })
})