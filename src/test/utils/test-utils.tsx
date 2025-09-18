import React from 'react'
import { render as rtlRender, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from 'next-themes'

// Create a custom render function that includes providers
function render(ui: React.ReactElement, options?: RenderOptions) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  const mockSession = {
    user: {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
    },
    expires: '2999-12-31T23:59:59.999Z',
  }

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <SessionProvider session={mockSession}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
          </ThemeProvider>
        </SessionProvider>
      </QueryClientProvider>
    )
  }

  return rtlRender(ui, { wrapper: Wrapper, ...options })
}

// Create test database client
export function createTestPrismaClient() {
  return {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    spark: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    todo: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }
}

// Mock data factories
export const mockUser = {
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  totalXP: 100,
  level: 1,
  currentStreak: 5,
  avatar: null,
  lastLoginAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  password: null,
  emailVerified: true,
}

export const mockSpark = {
  id: '1',
  userId: '1',
  title: 'Test Spark',
  description: 'A test spark for unit testing',
  content: '# Test Content',
  status: 'SEEDLING' as const,
  xp: 10,
  level: 1,
  positionX: 0,
  positionY: 0,
  color: '#10b981',
  tags: '["test", "unit"]',
  createdAt: new Date(),
  updatedAt: new Date(),
}

export const mockTodo = {
  id: '1',
  sparkId: '1',
  title: 'Test Todo',
  description: 'A test todo item',
  completed: false,
  type: 'GENERAL' as const,
  priority: 'MEDIUM' as const,
  positionX: null,
  positionY: null,
  createdAt: new Date(),
  completedAt: null,
}

// Re-export everything
export * from '@testing-library/react'
export { render }