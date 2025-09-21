import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { SparkProvider, useSpark } from '@/contexts/spark-context'
import { SparkStatus } from '@/types/spark'
vi.mock('@/contexts/guest-context', () => {
  const store = {
    sparks: [] as any[],
    todos: [] as any[],
    preferences: { viewMode: 'canvas' },
  }

  return {
    useGuest: () => ({
      isGuest: true,
      guestId: 'guest-test-user',
      guestData: store,
      saveGuestData: (data: Partial<typeof store>) => Object.assign(store, data),
      loadGuestData: () => store,
      clearGuestData: () => {
        store.sparks = []
        store.todos = []
        store.preferences = { viewMode: 'canvas' }
      },
      migrateToAccount: async () => undefined,
      mergeWithAccount: async () => undefined,
    }),
    GuestProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SparkProvider>{children}</SparkProvider>
)

describe('Spark lifecycle (guest mode)', () => {
  test('creates sparks with default metadata and custom overrides', async () => {
    const { result } = renderHook(() => useSpark(), { wrapper })

    await act(async () => {
      await result.current.actions.createSpark({
        title: 'Seed idea',
        description: 'Initial concept',
        status: SparkStatus.SEEDLING,
        xp: 0,
        level: 1,
        color: '#10b981',
        tags: 'init',
      })
    })

    const created = result.current.state.sparks[0]
    expect(created).toMatchObject({
      title: 'Seed idea',
      status: SparkStatus.SEEDLING,
      xp: 0,
      level: 1,
      color: '#10b981',
    })
    expect(created.id).toContain('guest_')
    expect(created.createdAt).toBeInstanceOf(Date)
    expect(created.updatedAt).toBeInstanceOf(Date)
  })

  test('advances spark through status transitions and position updates', async () => {
    const { result } = renderHook(() => useSpark(), { wrapper })

    await act(async () => {
      await result.current.actions.createSpark({
        title: 'Progression spark',
        status: SparkStatus.SEEDLING,
        description: '',
        xp: 0,
        level: 1,
        color: '#3b82f6',
        tags: undefined,
      })
    })

    const sparkId = result.current.state.sparks[0].id

    await act(async () => {
      await result.current.actions.updateSpark(sparkId, {
        status: SparkStatus.SAPLING,
        positionX: 120,
        positionY: 80,
      })
    })

    let spark = result.current.state.sparks.find((s) => s.id === sparkId)
    expect(spark?.status).toBe(SparkStatus.SAPLING)
    expect(spark?.positionX).toBe(120)
    expect(spark?.positionY).toBe(80)

    await act(async () => {
      await result.current.actions.updateSpark(sparkId, {
        status: SparkStatus.FOREST,
      })
    })

    spark = result.current.state.sparks.find((s) => s.id === sparkId)
    expect(spark?.status).toBe(SparkStatus.FOREST)
  })

  test('selects, filters, and deletes sparks safely', async () => {
    const { result } = renderHook(() => useSpark(), { wrapper })

    await act(async () => {
      await result.current.actions.createSpark({
        title: 'Alpha',
        status: SparkStatus.SEEDLING,
        description: '',
        xp: 0,
        level: 1,
        color: '#10b981',
        tags: undefined,
      })
      await result.current.actions.createSpark({
        title: 'Beta',
        status: SparkStatus.TREE,
        description: '',
        xp: 100,
        level: 2,
        color: '#f97316',
        tags: 'growth',
      })
    })

    const treeSparks = result.current.state.sparks.filter(
      (spark) => spark.status === SparkStatus.TREE
    )
    expect(treeSparks).toHaveLength(1)
    expect(treeSparks[0].title).toBe('Beta')

    act(() => {
      result.current.actions.selectSpark(treeSparks[0])
    })
    expect(result.current.state.selectedSpark?.title).toBe('Beta')

    await act(async () => {
      await result.current.actions.deleteSpark(treeSparks[0].id)
    })

    expect(result.current.state.sparks.find((s) => s.id === treeSparks[0].id)).toBeUndefined()
    expect(result.current.state.selectedSpark).toBeNull()
  })
})
