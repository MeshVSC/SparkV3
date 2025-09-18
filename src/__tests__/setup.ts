import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn()
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/'
}))

// Mock NextAuth
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com'
      }
    },
    status: 'authenticated'
  }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children
}))

// Mock Prisma
vi.mock('@/lib/db', () => ({
  db: {
    spark: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn()
    }
  }
}))

// Mock localStorage
const localStorageMock = {
  store: new Map<string, string>(),
  getItem: vi.fn((key: string) => localStorageMock.store.get(key) || null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock.store.set(key, value)
  }),
  removeItem: vi.fn((key: string) => {
    localStorageMock.store.delete(key)
  }),
  clear: vi.fn(() => {
    localStorageMock.store.clear()
  })
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock performance API
Object.defineProperty(window, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByType: vi.fn(() => []),
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 2000000
    }
  }
})

// Mock fetch
global.fetch = vi.fn()

// Mock File
global.File = class MockFile {
  constructor(public content: string[], public name: string, public options?: FilePropertyBag) {}
  
  get size() {
    return this.content.join('').length
  }
  
  get type() {
    return this.options?.type || 'text/plain'
  }
  
  async text() {
    return this.content.join('')
  }
}

// Mock navigator
Object.defineProperty(window, 'navigator', {
  value: {
    ...window.navigator,
    onLine: true,
    serviceWorker: {
      register: vi.fn(() => Promise.resolve({ update: vi.fn() })),
      getRegistration: vi.fn(() => Promise.resolve({ update: vi.fn() }))
    }
  }
})

export const mockFileUpload = (name: string, content: string, type = 'text/plain') => {
  return new File([content], name, { type })
}