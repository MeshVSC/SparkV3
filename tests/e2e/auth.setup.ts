import { test as setup, expect } from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, '../playwright/.auth/user.json')

setup('authenticate', async ({ page }) => {
  // Perform authentication steps. Replace these actions with your own.
  await page.goto('/')
  
  // If already authenticated, skip
  const isLoggedIn = await page.locator('[data-testid="user-menu"]').count()
  if (isLoggedIn > 0) {
    await page.context().storageState({ path: authFile })
    return
  }

  // Navigate to sign in page
  await page.getByRole('link', { name: 'Sign In' }).click()
  
  // Fill in authentication form
  await page.getByLabel('Email').fill('test@example.com')
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Sign In' }).click()
  
  // Wait for successful login
  await expect(page.getByTestId('user-menu')).toBeVisible()
  
  // End of authentication steps.
  await page.context().storageState({ path: authFile })
})