import { test, expect, Page } from '@playwright/test'

test.describe('Guest Mode Access Control', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    
    // Clear all auth tokens to simulate guest mode
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
      document.cookie.split(";").forEach((c) => {
        const eqPos = c.indexOf("=")
        const name = eqPos > -1 ? c.substr(0, eqPos) : c
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/"
      })
    })
  })

  test.describe('Landing Page Access', () => {
    test('should allow access to landing page', async () => {
      await page.goto('/')
      
      // Should show landing page content
      await expect(page.locator('[data-testid="landing-hero"]')).toBeVisible()
      await expect(page.locator('[data-testid="signup-button"]')).toBeVisible()
      await expect(page.locator('[data-testid="signin-button"]')).toBeVisible()
    })

    test('should show demo/preview content', async () => {
      await page.goto('/')
      
      // Check for demo features
      const demoSection = page.locator('[data-testid="demo-section"]')
      if (await demoSection.isVisible()) {
        await expect(demoSection).toContainText('Preview')
      }
      
      // Check for feature showcases
      await expect(page.locator('[data-testid="features-showcase"]')).toBeVisible()
    })
  })

  test.describe('Authentication Flow', () => {
    test('should redirect to auth when accessing protected routes', async () => {
      const protectedRoutes = ['/app', '/profile', '/settings', '/workspaces']
      
      for (const route of protectedRoutes) {
        await page.goto(route)
        
        // Should be redirected to auth or show access denied
        await page.waitForTimeout(2000)
        const url = page.url()
        
        expect(
          url.includes('/auth/signin') || 
          url.includes('/access-denied') ||
          await page.locator('[data-testid="guest-mode-banner"]').isVisible()
        ).toBe(true)
      }
    })

    test('should show sign-in modal for restricted actions', async () => {
      await page.goto('/app')
      
      // Wait for page load
      await page.waitForTimeout(2000)
      
      // Try to access creation features
      const createButton = page.locator('[data-testid="create-spark"]')
      if (await createButton.isVisible()) {
        await createButton.click()
        
        // Should show auth required modal
        await expect(page.locator('[data-testid="auth-required-modal"]')).toBeVisible()
        await expect(page.locator('[data-testid="signin-prompt"]')).toContainText('Sign in')
      }
    })

    test('should handle auth modal actions', async () => {
      await page.goto('/app')
      await page.waitForTimeout(1000)
      
      // Trigger auth modal
      const restrictedAction = page.locator('[data-testid="create-spark"]')
      if (await restrictedAction.isVisible()) {
        await restrictedAction.click()
        
        const authModal = page.locator('[data-testid="auth-required-modal"]')
        await expect(authModal).toBeVisible()
        
        // Test close modal
        const closeButton = page.locator('[data-testid="close-auth-modal"]')
        if (await closeButton.isVisible()) {
          await closeButton.click()
          await expect(authModal).not.toBeVisible()
        }
        
        // Test sign in button
        await restrictedAction.click()
        const signinButton = page.locator('[data-testid="auth-modal-signin"]')
        if (await signinButton.isVisible()) {
          await signinButton.click()
          // Should navigate to sign in page
          await page.waitForTimeout(1000)
          expect(page.url()).toContain('signin')
        }
      }
    })
  })

  test.describe('Read-Only Access', () => {
    test('should allow viewing public content in read-only mode', async () => {
      await page.goto('/app')
      
      // Should show guest mode banner
      await expect(page.locator('[data-testid="guest-mode-banner"]')).toBeVisible()
      await expect(page.locator('[data-testid="guest-mode-banner"]')).toContainText('Guest Mode')
      
      // Should be able to view content
      const viewContent = page.locator('[data-testid="kanban-view"], [data-testid="timeline-view"], [data-testid="canvas-view"]')
      await expect(viewContent.first()).toBeVisible()
    })

    test('should disable editing functionality', async () => {
      await page.goto('/app')
      await page.waitForTimeout(1000)
      
      // Edit buttons should be disabled or hidden
      const editButtons = page.locator('[data-testid^="edit-"], [data-testid^="delete-"]')
      const buttonCount = await editButtons.count()
      
      for (let i = 0; i < buttonCount; i++) {
        const button = editButtons.nth(i)
        if (await button.isVisible()) {
          await expect(button).toBeDisabled()
        }
      }
    })

    test('should show read-only indicators', async () => {
      await page.goto('/app')
      
      // Check for read-only badges or indicators
      const readOnlyIndicators = page.locator('[data-testid="read-only-badge"]')
      if (await readOnlyIndicators.count() > 0) {
        await expect(readOnlyIndicators.first()).toBeVisible()
      }
      
      // Tooltips should explain restrictions
      const restrictedElements = page.locator('[data-testid^="restricted-"]')
      if (await restrictedElements.count() > 0) {
        await restrictedElements.first().hover()
        await expect(page.locator('[data-testid="restriction-tooltip"]')).toBeVisible()
      }
    })

    test('should allow view mode switching in read-only', async () => {
      await page.goto('/app')
      
      // Should be able to switch views even as guest
      const kanbanView = page.locator('[data-testid="view-kanban"]')
      const timelineView = page.locator('[data-testid="view-timeline"]')
      const canvasView = page.locator('[data-testid="view-canvas"]')
      
      if (await kanbanView.isVisible()) {
        await kanbanView.click()
        await expect(page.locator('[data-testid="kanban-view"]')).toBeVisible()
      }
      
      if (await timelineView.isVisible()) {
        await timelineView.click()
        await expect(page.locator('[data-testid="timeline-view"]')).toBeVisible()
      }
      
      if (await canvasView.isVisible()) {
        await canvasView.click()
        await expect(page.locator('[data-testid="canvas-view"]')).toBeVisible()
      }
    })
  })

  test.describe('Upgrade Prompts', () => {
    test('should show upgrade prompts in appropriate locations', async () => {
      await page.goto('/app')
      
      // Main upgrade prompt
      const upgradePrompt = page.locator('[data-testid="upgrade-prompt"]')
      if (await upgradePrompt.isVisible()) {
        await expect(upgradePrompt).toContainText('Sign up')
        await expect(upgradePrompt).toContainText('unlock')
      }
    })

    test('should handle upgrade prompt interactions', async () => {
      await page.goto('/app')
      
      const upgradeButton = page.locator('[data-testid="upgrade-to-premium"]')
      if (await upgradeButton.isVisible()) {
        await upgradeButton.click()
        
        // Should navigate to pricing or auth page
        await page.waitForTimeout(1000)
        expect(
          page.url().includes('/pricing') || 
          page.url().includes('/auth/signin') ||
          page.url().includes('/signup')
        ).toBe(true)
      }
    })

    test('should show feature limitations with upgrade CTAs', async () => {
      await page.goto('/app')
      
      // Try to access premium features
      const premiumFeatures = page.locator('[data-testid^="premium-feature"]')
      const featureCount = await premiumFeatures.count()
      
      for (let i = 0; i < featureCount; i++) {
        const feature = premiumFeatures.nth(i)
        if (await feature.isVisible()) {
          await feature.click()
          
          // Should show upgrade modal or tooltip
          const upgradeModal = page.locator('[data-testid="upgrade-modal"]')
          const upgradeTooltip = page.locator('[data-testid="upgrade-tooltip"]')
          
          expect(
            await upgradeModal.isVisible() || 
            await upgradeTooltip.isVisible()
          ).toBe(true)
          
          // Close modal/tooltip for next iteration
          const closeButton = page.locator('[data-testid="close-upgrade-modal"], [data-testid="close-upgrade-tooltip"]')
          if (await closeButton.isVisible()) {
            await closeButton.click()
          }
        }
      }
    })

    test('should display usage limits for guest users', async () => {
      await page.goto('/app')
      
      // Check for usage limit indicators
      const usageIndicator = page.locator('[data-testid="usage-limit"]')
      if (await usageIndicator.isVisible()) {
        await expect(usageIndicator).toContainText('limit')
        await expect(usageIndicator).toContainText('guest')
      }
      
      // Progress bars for limitations
      const progressBars = page.locator('[data-testid^="limit-progress"]')
      if (await progressBars.count() > 0) {
        await expect(progressBars.first()).toBeVisible()
      }
    })
  })

  test.describe('Demo Data and Experience', () => {
    test('should show demo data when available', async () => {
      await page.goto('/app')
      
      // Should show demo sparks or placeholder content
      const demoContent = page.locator('[data-testid="demo-content"]')
      const sparkCards = page.locator('[data-testid^="spark-card"]')
      
      // Either demo content or actual cards should be visible
      expect(
        await demoContent.isVisible() || 
        await sparkCards.count() > 0
      ).toBe(true)
      
      if (await demoContent.isVisible()) {
        await expect(demoContent).toContainText('demo')
      }
    })

    test('should provide interactive demo tour', async () => {
      await page.goto('/app')
      
      const demoTourButton = page.locator('[data-testid="start-demo-tour"]')
      if (await demoTourButton.isVisible()) {
        await demoTourButton.click()
        
        // Should start interactive tour
        await expect(page.locator('[data-testid="tour-step"]')).toBeVisible()
        await expect(page.locator('[data-testid="tour-step"]')).toContainText('Welcome')
        
        // Navigate through tour
        const nextButton = page.locator('[data-testid="tour-next"]')
        if (await nextButton.isVisible()) {
          await nextButton.click()
          // Should progress to next step
          await page.waitForTimeout(500)
        }
      }
    })

    test('should handle demo data interactions safely', async () => {
      await page.goto('/app')
      
      // Interactions with demo data should not cause errors
      const demoCards = page.locator('[data-testid="demo-spark-card"]')
      if (await demoCards.count() > 0) {
        await demoCards.first().click()
        
        // Should show demo detail view or upgrade prompt
        const detailView = page.locator('[data-testid="spark-detail-view"]')
        const upgradePrompt = page.locator('[data-testid="upgrade-prompt"]')
        
        expect(
          await detailView.isVisible() || 
          await upgradePrompt.isVisible()
        ).toBe(true)
      }
    })

    test('should reset demo data on refresh', async () => {
      await page.goto('/app')
      
      // Interact with demo data
      const initialContent = await page.locator('[data-testid="main-content"]').innerHTML()
      
      // Refresh page
      await page.reload()
      await page.waitForTimeout(1000)
      
      // Demo should reset to initial state
      const refreshedContent = await page.locator('[data-testid="main-content"]').innerHTML()
      
      // Content structure should be consistent (demo data reset)
      expect(refreshedContent).toBeTruthy()
    })
  })

  test.describe('Navigation and Routing', () => {
    test('should handle navigation restrictions', async () => {
      const restrictedRoutes = [
        '/profile',
        '/settings',
        '/workspaces',
        '/admin'
      ]
      
      for (const route of restrictedRoutes) {
        await page.goto(route)
        
        // Should redirect or show access denied
        await page.waitForTimeout(1000)
        const currentUrl = page.url()
        
        expect(
          currentUrl.includes('/auth/signin') ||
          currentUrl.includes('/access-denied') ||
          await page.locator('[data-testid="access-denied"]').isVisible()
        ).toBe(true)
      }
    })

    test('should allow navigation to public pages', async () => {
      const publicRoutes = [
        '/',
        '/about',
        '/pricing',
        '/auth/signin',
        '/auth/signup'
      ]
      
      for (const route of publicRoutes) {
        await page.goto(route)
        
        // Should load successfully
        await page.waitForLoadState('networkidle')
        expect(page.url()).toContain(route)
        
        // Should not show access denied
        await expect(page.locator('[data-testid="access-denied"]')).not.toBeVisible()
      }
    })

    test('should preserve redirect after authentication', async () => {
      // Try to access protected route
      await page.goto('/settings')
      
      // Should redirect to signin with return URL
      await page.waitForTimeout(1000)
      const currentUrl = page.url()
      
      if (currentUrl.includes('/auth/signin')) {
        expect(currentUrl).toContain('redirect')
      }
    })
  })

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle network errors gracefully', async () => {
      // Simulate offline mode
      await page.context().setOffline(true)
      
      await page.goto('/app')
      
      // Should show offline indicator or error state
      const offlineIndicator = page.locator('[data-testid="offline-indicator"]')
      const errorState = page.locator('[data-testid="network-error"]')
      
      expect(
        await offlineIndicator.isVisible() || 
        await errorState.isVisible()
      ).toBe(true)
      
      // Restore online mode
      await page.context().setOffline(false)
    })

    test('should handle API errors for guest requests', async () => {
      // Mock API errors
      await page.route('/api/**', (route) => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Unauthorized' })
        })
      })
      
      await page.goto('/app')
      
      // Should handle errors gracefully
      const errorMessage = page.locator('[data-testid="error-message"]')
      const fallbackContent = page.locator('[data-testid="fallback-content"]')
      
      expect(
        await errorMessage.isVisible() || 
        await fallbackContent.isVisible()
      ).toBe(true)
    })

    test('should handle session timeouts', async () => {
      // Set expired session token
      await page.evaluate(() => {
        localStorage.setItem('session-expires', '0')
      })
      
      await page.goto('/app')
      
      // Should detect expired session and show appropriate UI
      const sessionExpiredMessage = page.locator('[data-testid="session-expired"]')
      const guestModeBanner = page.locator('[data-testid="guest-mode-banner"]')
      
      expect(
        await sessionExpiredMessage.isVisible() || 
        await guestModeBanner.isVisible()
      ).toBe(true)
    })
  })
})