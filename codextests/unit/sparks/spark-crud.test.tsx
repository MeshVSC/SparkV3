import { describe, it, expect, beforeEach, vi } from "vitest"
import React, { type ReactNode } from "react"
import { act, renderHook, waitFor } from "@testing-library/react"

vi.mock("@/lib/api/spark-api", () => {
  const sparkApiMock = {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    updatePosition: vi.fn(),
    addTodo: vi.fn(),
    updateTodo: vi.fn(),
    deleteTodo: vi.fn(),
    search: vi.fn(),
    getUserStats: vi.fn(),
    getAttachments: vi.fn(),
    uploadAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
    createConnection: vi.fn(),
    updateConnection: vi.fn(),
    deleteConnection: vi.fn(),
    getConnections: vi.fn(),
  }

  return { sparkApi: sparkApiMock }
})

vi.mock("@/contexts/guest-context", () => ({
  useGuest: () => ({
    isGuest: false,
    guestData: null,
    saveGuestData: vi.fn(),
    loadGuestData: vi.fn(),
    clearGuestData: vi.fn(),
    migrateToAccount: vi.fn(),
    mergeWithAccount: vi.fn(),
  }),
  GuestProvider: ({ children }: { children: ReactNode | null }) => <>{children}</>,
}))

import { sparkApi } from "@/lib/api/spark-api"
import { SparkProvider, useSpark } from "@/contexts/spark-context"
import { SparkStatus, type CreateSparkData, type Spark } from "@/types/spark"

const mockedSparkApi = vi.mocked(sparkApi)

const createInput: CreateSparkData = {
  title: "Test Spark",
  description: "Testing create flow",
  content: "Content",
  status: SparkStatus.SEEDLING,
  xp: 0,
  level: 1,
  positionX: 10,
  positionY: 20,
  color: "#10b981",
  tags: "testing",
}

const baseSpark: Spark = {
  id: "spark-1",
  userId: "user-1",
  title: createInput.title,
  description: createInput.description,
  content: createInput.content,
  status: createInput.status,
  xp: 10,
  level: 1,
  positionX: createInput.positionX,
  positionY: createInput.positionY,
  color: createInput.color,
  tags: createInput.tags,
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
  todos: [],
  attachments: [],
  connections: [],
}

describe("SparkProvider CRUD actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedSparkApi.getAll.mockResolvedValue([])
  })

  it("creates a spark and adds it to state", async () => {
    const createdSpark: Spark = {
      ...baseSpark,
      xp: 15,
      updatedAt: new Date("2024-01-02T00:00:00.000Z"),
    }
    mockedSparkApi.create.mockResolvedValue(createdSpark)

    const wrapper = ({ children }: { children: ReactNode }) => (
      <SparkProvider>{children}</SparkProvider>
    )

    const { result, unmount } = renderHook(() => useSpark(), { wrapper })

    await waitFor(() => {
      expect(mockedSparkApi.getAll).toHaveBeenCalled()
    })

    await act(async () => {
      await result.current.actions.createSpark(createInput)
    })

    expect(mockedSparkApi.create).toHaveBeenCalledWith(createInput)
    expect(result.current.state.sparks).toHaveLength(1)
    expect(result.current.state.sparks[0]).toEqual(createdSpark)

    unmount()
  })

  it("updates an existing spark", async () => {
    const createdSpark: Spark = {
      ...baseSpark,
      xp: 12,
    }
    const updatedSpark: Spark = {
      ...createdSpark,
      title: "Updated Spark",
      description: "Updated description",
      status: SparkStatus.SAPLING,
      xp: 50,
      updatedAt: new Date("2024-02-01T00:00:00.000Z"),
    }

    mockedSparkApi.create.mockResolvedValue(createdSpark)
    mockedSparkApi.update.mockResolvedValue(updatedSpark)

    const wrapper = ({ children }: { children: ReactNode }) => (
      <SparkProvider>{children}</SparkProvider>
    )

    const { result, unmount } = renderHook(() => useSpark(), { wrapper })

    await waitFor(() => {
      expect(mockedSparkApi.getAll).toHaveBeenCalled()
    })

    await act(async () => {
      await result.current.actions.createSpark(createInput)
    })

    await act(async () => {
      await result.current.actions.updateSpark(createdSpark.id, {
        title: updatedSpark.title,
        description: updatedSpark.description,
        status: updatedSpark.status,
        xp: updatedSpark.xp,
      })
    })

    expect(mockedSparkApi.update).toHaveBeenCalledWith(createdSpark.id, {
      title: updatedSpark.title,
      description: updatedSpark.description,
      status: updatedSpark.status,
      xp: updatedSpark.xp,
    })

    expect(result.current.state.sparks).toHaveLength(1)
    expect(result.current.state.sparks[0]).toEqual(updatedSpark)

    unmount()
  })

  it("deletes a spark from state", async () => {
    const createdSpark: Spark = {
      ...baseSpark,
      id: "spark-to-delete",
    }

    mockedSparkApi.create.mockResolvedValue(createdSpark)
    mockedSparkApi.delete.mockResolvedValue(undefined)

    const wrapper = ({ children }: { children: ReactNode }) => (
      <SparkProvider>{children}</SparkProvider>
    )

    const { result, unmount } = renderHook(() => useSpark(), { wrapper })

    await waitFor(() => {
      expect(mockedSparkApi.getAll).toHaveBeenCalled()
    })

    await act(async () => {
      await result.current.actions.createSpark(createInput)
    })

    await act(async () => {
      await result.current.actions.deleteSpark(createdSpark.id)
    })

    expect(mockedSparkApi.delete).toHaveBeenCalledWith(createdSpark.id)
    expect(result.current.state.sparks).toHaveLength(0)

    unmount()
  })
})
