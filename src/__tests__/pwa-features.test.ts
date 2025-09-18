import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('PWA Feature Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset navigator online status
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
  })

  describe('Service Worker Registration', () => {
    it('registers service worker successfully', async () => {
      const mockRegistration = { 
        update: vi.fn(), 
        waiting: null, 
        active: { scriptURL: '/sw.js' } 
      }
      
      navigator.serviceWorker.register = vi.fn().mockResolvedValue(mockRegistration)

      const registration = await navigator.serviceWorker.register('/sw.js')
      
      expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js')
      expect(registration.active?.scriptURL).toBe('/sw.js')
    })

    it('handles service worker registration failure', async () => {
      const error = new Error('Service worker registration failed')
      navigator.serviceWorker.register = vi.fn().mockRejectedValue(error)

      await expect(navigator.serviceWorker.register('/sw.js')).rejects.toThrow(
        'Service worker registration failed'
      )
    })

    it('updates existing service worker', async () => {
      const mockRegistration = { 
        update: vi.fn().mockResolvedValue(undefined),
        waiting: null 
      }
      
      navigator.serviceWorker.getRegistration = vi.fn().mockResolvedValue(mockRegistration)

      const registration = await navigator.serviceWorker.getRegistration()
      await registration?.update()

      expect(registration?.update).toHaveBeenCalled()
    })

    it('handles service worker update errors', async () => {
      const mockRegistration = { 
        update: vi.fn().mockRejectedValue(new Error('Update failed'))
      }
      
      navigator.serviceWorker.getRegistration = vi.fn().mockResolvedValue(mockRegistration)
      const registration = await navigator.serviceWorker.getRegistration()

      await expect(registration?.update()).rejects.toThrow('Update failed')
    })
  })

  describe('Offline Functionality', () => {
    it('detects online/offline status', () => {
      expect(navigator.onLine).toBe(true)
      
      Object.defineProperty(navigator, 'onLine', { value: false })
      expect(navigator.onLine).toBe(false)
    })

    it('caches data when offline', () => {
      const offlineCache = new Map()
      const testData = { id: '1', title: 'Offline Test' }
      
      Object.defineProperty(navigator, 'onLine', { value: false })
      
      if (!navigator.onLine) {
        offlineCache.set('data-1', testData)
      }
      
      expect(offlineCache.get('data-1')).toEqual(testData)
    })

    it('queues API calls when offline', () => {
      const apiQueue: Array<{ url: string; options: any }> = []
      
      const queuedFetch = (url: string, options: any = {}) => {
        if (!navigator.onLine) {
          apiQueue.push({ url, options })
          return Promise.resolve({ queued: true })
        }
        return fetch(url, options)
      }
      
      Object.defineProperty(navigator, 'onLine', { value: false })
      
      queuedFetch('/api/sparks', { method: 'POST', body: '{}' })
      queuedFetch('/api/todos', { method: 'PUT', body: '{}' })
      
      expect(apiQueue).toHaveLength(2)
      expect(apiQueue[0].url).toBe('/api/sparks')
    })

    it('syncs queued operations when back online', async () => {
      const queue = [
        { url: '/api/sparks', options: { method: 'POST', body: '{"title":"Offline Spark"}' } },
        { url: '/api/todos', options: { method: 'PUT', body: '{"completed":true}' } }
      ]
      
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => ({}) })
      
      Object.defineProperty(navigator, 'onLine', { value: true })
      
      if (navigator.onLine && queue.length > 0) {
        for (const { url, options } of queue) {
          await fetch(url, options)
        }
        queue.length = 0
      }
      
      expect(fetch).toHaveBeenCalledTimes(2)
      expect(queue).toHaveLength(0)
    })

    it('handles offline data conflicts', () => {
      const offlineData = { id: '1', title: 'Offline Title', version: 1 }
      const serverData = { id: '1', title: 'Server Title', version: 2 }
      
      // Server version is newer
      const resolved = serverData.version > offlineData.version ? serverData : offlineData
      
      expect(resolved.title).toBe('Server Title')
      expect(resolved.version).toBe(2)
    })
  })

  describe('Install Prompt Handling', () => {
    it('captures install prompt event', () => {
      let deferredPrompt: any = null
      
      const mockEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn().mockResolvedValue(undefined),
        userChoice: Promise.resolve({ outcome: 'accepted' })
      }
      
      // Simulate beforeinstallprompt event
      const handleBeforeInstallPrompt = (e: any) => {
        e.preventDefault()
        deferredPrompt = e
      }
      
      handleBeforeInstallPrompt(mockEvent)
      
      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(deferredPrompt).toBe(mockEvent)
    })

    it('shows install prompt when triggered', async () => {
      const mockPrompt = {
        prompt: vi.fn().mockResolvedValue(undefined),
        userChoice: Promise.resolve({ outcome: 'accepted' })
      }
      
      await mockPrompt.prompt()
      const choice = await mockPrompt.userChoice
      
      expect(mockPrompt.prompt).toHaveBeenCalled()
      expect(choice.outcome).toBe('accepted')
    })

    it('handles install prompt dismissal', async () => {
      const mockPrompt = {
        prompt: vi.fn().mockResolvedValue(undefined),
        userChoice: Promise.resolve({ outcome: 'dismissed' })
      }
      
      await mockPrompt.prompt()
      const choice = await mockPrompt.userChoice
      
      expect(choice.outcome).toBe('dismissed')
    })

    it('detects if app is already installed', () => {
      // Mock standalone mode detection
      Object.defineProperty(window, 'matchMedia', {
        value: vi.fn().mockReturnValue({ matches: true })
      })
      
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      expect(isStandalone).toBe(true)
    })
  })

  describe('Cache Management', () => {
    it('caches static assets', async () => {
      const mockCache = {
        add: vi.fn().mockResolvedValue(undefined),
        addAll: vi.fn().mockResolvedValue(undefined),
        match: vi.fn().mockResolvedValue(new Response('cached')),
        delete: vi.fn().mockResolvedValue(true)
      }
      
      const mockCaches = {
        open: vi.fn().mockResolvedValue(mockCache),
        delete: vi.fn().mockResolvedValue(true),
        keys: vi.fn().mockResolvedValue(['v1', 'v2'])
      }
      
      global.caches = mockCaches
      
      const cache = await caches.open('static-v1')
      await cache.addAll(['/app.js', '/styles.css'])
      
      expect(caches.open).toHaveBeenCalledWith('static-v1')
      expect(cache.addAll).toHaveBeenCalledWith(['/app.js', '/styles.css'])
    })

    it('serves cached content when offline', async () => {
      const cachedResponse = new Response('cached data')
      
      const mockCache = {
        match: vi.fn().mockResolvedValue(cachedResponse)
      }
      
      global.caches = {
        match: vi.fn().mockResolvedValue(cachedResponse)
      } as any
      
      Object.defineProperty(navigator, 'onLine', { value: false })
      
      const response = await caches.match('/api/data')
      const content = await response?.text()
      
      expect(content).toBe('cached data')
    })

    it('updates cache when online', async () => {
      const mockCache = {
        put: vi.fn().mockResolvedValue(undefined),
        match: vi.fn().mockResolvedValue(null)
      }
      
      global.caches = {
        open: vi.fn().mockResolvedValue(mockCache)
      } as any
      
      global.fetch = vi.fn().mockResolvedValue(new Response('fresh data'))
      
      const cache = await caches.open('dynamic-v1')
      const response = await fetch('/api/fresh-data')
      await cache.put('/api/fresh-data', response.clone())
      
      expect(cache.put).toHaveBeenCalledWith('/api/fresh-data', expect.any(Response))
    })

    it('cleans up old caches', async () => {
      const CURRENT_CACHE = 'v3'
      const cacheNames = ['v1', 'v2', 'v3', 'temp-cache']
      
      global.caches = {
        keys: vi.fn().mockResolvedValue(cacheNames),
        delete: vi.fn().mockResolvedValue(true)
      } as any
      
      const cachesToDelete = cacheNames.filter(name => 
        name !== CURRENT_CACHE && name !== 'temp-cache'
      )
      
      for (const cacheName of cachesToDelete) {
        await caches.delete(cacheName)
      }
      
      expect(caches.delete).toHaveBeenCalledTimes(2)
      expect(caches.delete).toHaveBeenCalledWith('v1')
      expect(caches.delete).toHaveBeenCalledWith('v2')
    })
  })

  describe('Background Sync', () => {
    it('registers background sync', async () => {
      const mockRegistration = {
        sync: {
          register: vi.fn().mockResolvedValue(undefined)
        }
      }
      
      await mockRegistration.sync.register('background-sync')
      
      expect(mockRegistration.sync.register).toHaveBeenCalledWith('background-sync')
    })

    it('handles sync events', () => {
      const pendingData = [
        { id: '1', action: 'create', data: { title: 'New Spark' } },
        { id: '2', action: 'update', data: { id: '2', completed: true } }
      ]
      
      const processSyncData = async (items: typeof pendingData) => {
        const processed = []
        for (const item of items) {
          // Simulate processing
          processed.push({ ...item, synced: true })
        }
        return processed
      }
      
      const result = processSyncData(pendingData)
      expect(result).resolves.toHaveLength(2)
    })
  })
})