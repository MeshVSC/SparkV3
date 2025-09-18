import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/')
    
    // Check if the page loads correctly
    await expect(page).toHaveTitle(/Spark/i)
    
    // Check for main navigation or key elements
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible()
  })

  test('should display navigation elements', async ({ page }) => {
    await page.goto('/')
    
    // Check for common navigation elements
    const nav = page.locator('nav').first()
    await expect(nav).toBeVisible()
  })

  test('should be responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    
    // Check that content is still visible on mobile
    const main = page.locator('main').first()
    await expect(main).toBeVisible()
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')
    
    // Check that content is still visible on desktop
    await expect(main).toBeVisible()
  })
})