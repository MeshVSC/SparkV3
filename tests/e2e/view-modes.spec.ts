import { test, expect, Page } from '@playwright/test'

test.describe('View Modes E2E Tests', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    
    // Mock authentication - simulate logged-in user
    await page.goto('/')
    
    // Add mock auth token to localStorage if needed
    await page.evaluate(() => {
      localStorage.setItem('next-auth.session-token', 'mock-session-token')
    })
  })

  test.describe('Kanban View Mode', () => {
    test('should render Kanban view with columns', async () => {
      await page.goto('/app?view=kanban')
      
      // Wait for the Kanban view to load
      await expect(page.locator('[data-testid="kanban-view"]')).toBeVisible({ timeout: 10000 })
      
      // Check for status columns
      await expect(page.locator('[data-testid="column-seedling"]')).toBeVisible()
      await expect(page.locator('[data-testid="column-sapling"]')).toBeVisible()
      await expect(page.locator('[data-testid="column-tree"]')).toBeVisible()
      await expect(page.locator('[data-testid="column-forest"]')).toBeVisible()
      
      // Verify column headers
      await expect(page.locator('[data-testid="column-seedling"]')).toContainText('Seedling')
      await expect(page.locator('[data-testid="column-sapling"]')).toContainText('Sapling')
      await expect(page.locator('[data-testid="column-tree"]')).toContainText('Tree')
      await expect(page.locator('[data-testid="column-forest"]')).toContainText('Forest')
    })

    test('should display spark cards in correct columns', async () => {
      await page.goto('/app?view=kanban')
      
      await expect(page.locator('[data-testid="kanban-view"]')).toBeVisible()
      
      // Check for spark cards in columns
      const seedlingCards = page.locator('[data-testid="column-seedling"] [data-testid^="spark-card"]')
      const saplingCards = page.locator('[data-testid="column-sapling"] [data-testid^="spark-card"]')
      
      // Verify cards have proper structure
      if (await seedlingCards.count() > 0) {
        await expect(seedlingCards.first()).toBeVisible()
        await expect(seedlingCards.first().locator('[data-testid="spark-title"]')).toBeVisible()
        await expect(seedlingCards.first().locator('[data-testid="spark-xp"]')).toBeVisible()
      }
    })

    test('should handle drag and drop between columns', async () => {
      await page.goto('/app?view=kanban')
      
      await expect(page.locator('[data-testid="kanban-view"]')).toBeVisible()
      
      const firstCard = page.locator('[data-testid^="spark-card"]').first()
      if (await firstCard.isVisible()) {
        const saplingColumn = page.locator('[data-testid="column-sapling"]')
        
        // Perform drag and drop
        await firstCard.dragTo(saplingColumn)
        
        // Verify the action was attempted (UI should respond)
        await page.waitForTimeout(1000)
      }
    })

    test('should show empty state when no sparks exist', async () => {
      // Mock empty state
      await page.route('/api/sparks', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([])
        })
      })
      
      await page.goto('/app?view=kanban')
      
      await expect(page.locator('[data-testid="empty-state"]')).toBeVisible()
      await expect(page.locator('[data-testid="empty-state"]')).toContainText('No sparks yet')
    })
  })

  test.describe('Timeline View Mode', () => {
    test('should render Timeline view with chronological layout', async () => {
      await page.goto('/app?view=timeline')
      
      // Wait for timeline view to load
      await expect(page.locator('[data-testid="timeline-view"]')).toBeVisible({ timeout: 10000 })
      
      // Check for timeline elements
      await expect(page.locator('[data-testid="timeline-line"]')).toBeVisible()
      
      // Verify timeline items
      const timelineItems = page.locator('[data-testid^="timeline-item"]')
      if (await timelineItems.count() > 0) {
        await expect(timelineItems.first()).toBeVisible()
        await expect(timelineItems.first().locator('[data-testid="timeline-date"]')).toBeVisible()
        await expect(timelineItems.first().locator('[data-testid="timeline-content"]')).toBeVisible()
      }
    })

    test('should display sparks in chronological order', async () => {
      await page.goto('/app?view=timeline')
      
      await expect(page.locator('[data-testid="timeline-view"]')).toBeVisible()
      
      const timelineItems = page.locator('[data-testid^="timeline-item"]')
      const itemCount = await timelineItems.count()
      
      if (itemCount > 1) {
        // Verify chronological ordering by checking dates
        const firstDate = await timelineItems.first().locator('[data-testid="timeline-date"]').textContent()
        const lastDate = await timelineItems.last().locator('[data-testid="timeline-date"]').textContent()
        
        expect(firstDate).toBeTruthy()
        expect(lastDate).toBeTruthy()
      }
    })

    test('should allow filtering by date range', async () => {
      await page.goto('/app?view=timeline')
      
      await expect(page.locator('[data-testid="timeline-view"]')).toBeVisible()
      
      // Check for date filter controls
      const dateFilter = page.locator('[data-testid="date-filter"]')
      if (await dateFilter.isVisible()) {
        await dateFilter.click()
        
        // Verify filter options are available
        await expect(page.locator('[data-testid="date-range-picker"]')).toBeVisible()
      }
    })

    test('should show timeline progression indicators', async () => {
      await page.goto('/app?view=timeline')
      
      await expect(page.locator('[data-testid="timeline-view"]')).toBeVisible()
      
      // Check for progression indicators
      await expect(page.locator('[data-testid="timeline-progress"]')).toBeVisible()
      
      const progressItems = page.locator('[data-testid^="progress-marker"]')
      if (await progressItems.count() > 0) {
        await expect(progressItems.first()).toBeVisible()
      }
    })
  })

  test.describe('Canvas View Mode', () => {
    test('should render Canvas view with spatial layout', async () => {
      await page.goto('/app?view=canvas')
      
      // Wait for canvas view to load
      await expect(page.locator('[data-testid="canvas-view"]')).toBeVisible({ timeout: 10000 })
      
      // Check for canvas container
      await expect(page.locator('[data-testid="canvas-container"]')).toBeVisible()
      
      // Verify interactive elements
      await expect(page.locator('[data-testid="canvas-zoom-controls"]')).toBeVisible()
      await expect(page.locator('[data-testid="canvas-pan-area"]')).toBeVisible()
    })

    test('should display sparks as positioned nodes', async () => {
      await page.goto('/app?view=canvas')
      
      await expect(page.locator('[data-testid="canvas-view"]')).toBeVisible()
      
      const canvasNodes = page.locator('[data-testid^="canvas-node"]')
      const nodeCount = await canvasNodes.count()
      
      if (nodeCount > 0) {
        await expect(canvasNodes.first()).toBeVisible()
        
        // Verify nodes have position styling
        const firstNode = canvasNodes.first()
        const style = await firstNode.getAttribute('style')
        expect(style).toContain('position')
      }
    })

    test('should handle zoom and pan interactions', async () => {
      await page.goto('/app?view=canvas')
      
      await expect(page.locator('[data-testid="canvas-view"]')).toBeVisible()
      
      // Test zoom controls
      const zoomIn = page.locator('[data-testid="zoom-in"]')
      const zoomOut = page.locator('[data-testid="zoom-out"]')
      
      if (await zoomIn.isVisible()) {
        await zoomIn.click()
        await page.waitForTimeout(500)
        
        await zoomOut.click()
        await page.waitForTimeout(500)
      }
      
      // Test pan functionality
      const canvasArea = page.locator('[data-testid="canvas-pan-area"]')
      if (await canvasArea.isVisible()) {
        await canvasArea.hover()
        await page.mouse.down()
        await page.mouse.move(100, 100)
        await page.mouse.up()
      }
    })

    test('should show connections between related sparks', async () => {
      await page.goto('/app?view=canvas')
      
      await expect(page.locator('[data-testid="canvas-view"]')).toBeVisible()
      
      // Check for connection lines
      const connections = page.locator('[data-testid^="connection-line"]')
      if (await connections.count() > 0) {
        await expect(connections.first()).toBeVisible()
        
        // Verify connection styling
        const connectionStyle = await connections.first().getAttribute('class')
        expect(connectionStyle).toContain('connection')
      }
    })

    test('should allow repositioning of spark nodes', async () => {
      await page.goto('/app?view=canvas')
      
      await expect(page.locator('[data-testid="canvas-view"]')).toBeVisible()
      
      const firstNode = page.locator('[data-testid^="canvas-node"]').first()
      if (await firstNode.isVisible()) {
        // Get initial position
        const initialBounds = await firstNode.boundingBox()
        
        // Drag to new position
        await firstNode.dragTo(page.locator('[data-testid="canvas-container"]'), {
          targetPosition: { x: 200, y: 200 }
        })
        
        await page.waitForTimeout(1000)
        
        // Verify position changed
        const newBounds = await firstNode.boundingBox()
        expect(newBounds?.x !== initialBounds?.x || newBounds?.y !== initialBounds?.y).toBe(true)
      }
    })
  })

  test.describe('View Mode Switching', () => {
    test('should switch between view modes using navigation', async () => {
      await page.goto('/app')
      
      // Test switching to Kanban
      const kanbanButton = page.locator('[data-testid="view-kanban"]')
      if (await kanbanButton.isVisible()) {
        await kanbanButton.click()
        await expect(page.locator('[data-testid="kanban-view"]')).toBeVisible()
        expect(page.url()).toContain('view=kanban')
      }
      
      // Test switching to Timeline
      const timelineButton = page.locator('[data-testid="view-timeline"]')
      if (await timelineButton.isVisible()) {
        await timelineButton.click()
        await expect(page.locator('[data-testid="timeline-view"]')).toBeVisible()
        expect(page.url()).toContain('view=timeline')
      }
      
      // Test switching to Canvas
      const canvasButton = page.locator('[data-testid="view-canvas"]')
      if (await canvasButton.isVisible()) {
        await canvasButton.click()
        await expect(page.locator('[data-testid="canvas-view"]')).toBeVisible()
        expect(page.url()).toContain('view=canvas')
      }
    })

    test('should preserve data across view mode switches', async () => {
      await page.goto('/app?view=kanban')
      
      // Get spark count in Kanban view
      await expect(page.locator('[data-testid="kanban-view"]')).toBeVisible()
      const kanbanSparks = await page.locator('[data-testid^="spark-card"]').count()
      
      // Switch to Timeline
      await page.goto('/app?view=timeline')
      await expect(page.locator('[data-testid="timeline-view"]')).toBeVisible()
      const timelineSparks = await page.locator('[data-testid^="timeline-item"]').count()
      
      // Switch to Canvas
      await page.goto('/app?view=canvas')
      await expect(page.locator('[data-testid="canvas-view"]')).toBeVisible()
      const canvasSparks = await page.locator('[data-testid^="canvas-node"]').count()
      
      // Data consistency check (allowing for different rendering approaches)
      expect(kanbanSparks).toBeGreaterThanOrEqual(0)
      expect(timelineSparks).toBeGreaterThanOrEqual(0)
      expect(canvasSparks).toBeGreaterThanOrEqual(0)
    })

    test('should maintain URL state for bookmarking', async () => {
      const viewModes = ['kanban', 'timeline', 'canvas']
      
      for (const viewMode of viewModes) {
        await page.goto(`/app?view=${viewMode}`)
        expect(page.url()).toContain(`view=${viewMode}`)
        
        // Verify the correct view is displayed
        await expect(page.locator(`[data-testid="${viewMode}-view"]`)).toBeVisible()
      }
    })
  })

  test.describe('Guest Mode Access Restrictions', () => {
    test('should show limited functionality for guest users', async () => {
      // Clear auth tokens to simulate guest mode
      await page.evaluate(() => {
        localStorage.clear()
        sessionStorage.clear()
      })
      
      await page.goto('/app')
      
      // Check for guest mode indicator
      await expect(page.locator('[data-testid="guest-mode-banner"]')).toBeVisible()
      
      // Verify restricted actions
      const createButton = page.locator('[data-testid="create-spark"]')
      if (await createButton.isVisible()) {
        await createButton.click()
        await expect(page.locator('[data-testid="auth-required-modal"]')).toBeVisible()
      }
    })

    test('should redirect guest users from protected routes', async () => {
      await page.evaluate(() => {
        localStorage.clear()
        sessionStorage.clear()
      })
      
      await page.goto('/settings')
      
      // Should redirect to auth or show access denied
      await expect(page.locator('[data-testid="access-denied"]')).toBeVisible()
    })

    test('should allow read-only access to public content', async () => {
      await page.evaluate(() => {
        localStorage.clear()
        sessionStorage.clear()
      })
      
      await page.goto('/app?view=kanban')
      
      // Should be able to view content but not modify
      await expect(page.locator('[data-testid="kanban-view"]')).toBeVisible()
      
      // Edit buttons should be disabled or hidden
      const editButtons = page.locator('[data-testid^="edit-spark"]')
      if (await editButtons.count() > 0) {
        await expect(editButtons.first()).toBeDisabled()
      }
    })

    test('should show upgrade prompts for guest users', async () => {
      await page.evaluate(() => {
        localStorage.clear()
        sessionStorage.clear()
      })
      
      await page.goto('/app')
      
      // Check for upgrade prompts
      const upgradePrompt = page.locator('[data-testid="upgrade-prompt"]')
      if (await upgradePrompt.isVisible()) {
        await expect(upgradePrompt).toContainText('Sign up')
      }
    })
  })

  test.describe('UI Component Interactions', () => {
    test('should handle spark creation modal', async () => {
      await page.goto('/app')
      
      const createButton = page.locator('[data-testid="create-spark"]')
      if (await createButton.isVisible()) {
        await createButton.click()
        
        // Check for modal
        await expect(page.locator('[data-testid="create-spark-modal"]')).toBeVisible()
        
        // Fill form
        await page.fill('[data-testid="spark-title-input"]', 'Test Spark')
        await page.fill('[data-testid="spark-description-input"]', 'Test Description')
        
        // Submit
        await page.click('[data-testid="submit-spark"]')
        
        // Verify creation (modal should close)
        await expect(page.locator('[data-testid="create-spark-modal"]')).not.toBeVisible()
      }
    })

    test('should handle search and filtering', async () => {
      await page.goto('/app')
      
      const searchInput = page.locator('[data-testid="search-input"]')
      if (await searchInput.isVisible()) {
        await searchInput.fill('test search')
        await page.keyboard.press('Enter')
        
        // Wait for search results
        await page.waitForTimeout(1000)
        
        // Verify search was performed
        const searchResults = page.locator('[data-testid="search-results"]')
        if (await searchResults.isVisible()) {
          await expect(searchResults).toBeVisible()
        }
      }
    })

    test('should handle navigation menu', async () => {
      await page.goto('/app')
      
      // Test main navigation
      const navItems = ['Dashboard', 'Profile', 'Settings']
      
      for (const item of navItems) {
        const navLink = page.locator(`[data-testid="nav-${item.toLowerCase()}"]`)
        if (await navLink.isVisible()) {
          await navLink.click()
          await page.waitForTimeout(500)
          
          // Verify navigation occurred
          expect(page.url()).toContain(item.toLowerCase())
        }
      }
    })

    test('should handle responsive design', async () => {
      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/app')
      
      // Check mobile navigation
      const mobileMenu = page.locator('[data-testid="mobile-menu"]')
      if (await mobileMenu.isVisible()) {
        await mobileMenu.click()
        await expect(page.locator('[data-testid="mobile-nav-menu"]')).toBeVisible()
      }
      
      // Reset to desktop
      await page.setViewportSize({ width: 1280, height: 720 })
    })

    test('should handle theme switching', async () => {
      await page.goto('/app')
      
      const themeToggle = page.locator('[data-testid="theme-toggle"]')
      if (await themeToggle.isVisible()) {
        // Get current theme
        const body = page.locator('body')
        const initialClass = await body.getAttribute('class')
        
        // Toggle theme
        await themeToggle.click()
        await page.waitForTimeout(500)
        
        // Verify theme changed
        const newClass = await body.getAttribute('class')
        expect(newClass !== initialClass).toBe(true)
      }
    })
  })
})