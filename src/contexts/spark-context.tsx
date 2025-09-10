"use client"

import React, { createContext, useContext, useReducer, useEffect } from "react"
import { Spark, Todo, Attachment, CreateSparkData, SparkConnection, ConnectionType, AttachmentType } from "@/types/spark"
import { AchievementService } from "@/lib/achievement-service"
import { sparkApi } from "@/lib/api/spark-api"
import { useGuest } from "@/contexts/guest-context"

interface SparkState {
  sparks: Spark[]
  selectedSpark: Spark | null
  isLoading: boolean
  error: string | null
  viewMode: "canvas" | "kanban" | "timeline" | "connections"
  searchQuery: string
  userStats: any | null
}

type SparkAction =
  | { type: "SET_SPARKS"; payload: Spark[] }
  | { type: "ADD_SPARK"; payload: Spark }
  | { type: "UPDATE_SPARK"; payload: Spark }
  | { type: "DELETE_SPARK"; payload: string }
  | { type: "SET_SELECTED_SPARK"; payload: Spark | null }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_VIEW_MODE"; payload: "canvas" | "kanban" | "timeline" | "connections" }
  | { type: "SET_SEARCH_QUERY"; payload: string }
  | { type: "SET_USER_STATS"; payload: any }
  | { type: "ADD_TODO"; payload: { sparkId: string; todo: Todo } }
  | { type: "UPDATE_TODO"; payload: { sparkId: string; todo: Todo } }
  | { type: "DELETE_TODO"; payload: { sparkId: string; todoId: string } }
  | { type: "ADD_ATTACHMENT"; payload: { sparkId: string; attachment: Attachment } }
  | { type: "DELETE_ATTACHMENT"; payload: { sparkId: string; attachmentId: string } }

const initialState: SparkState = {
  sparks: [],
  selectedSpark: null,
  isLoading: false,
  error: null,
  viewMode: "canvas",
  searchQuery: "",
  userStats: null,
}

function sparkReducer(state: SparkState, action: SparkAction): SparkState {
  switch (action.type) {
    case "SET_SPARKS":
      return { ...state, sparks: action.payload }

    case "ADD_SPARK":
      return { ...state, sparks: [...state.sparks, action.payload] }

    case "UPDATE_SPARK":
      return {
        ...state,
        sparks: state.sparks.map(spark =>
          spark.id === action.payload.id ? action.payload : spark
        ),
        selectedSpark: state.selectedSpark?.id === action.payload.id
          ? action.payload
          : state.selectedSpark,
      }

    case "DELETE_SPARK":
      return {
        ...state,
        sparks: state.sparks.filter(spark => spark.id !== action.payload),
        selectedSpark: state.selectedSpark?.id === action.payload ? null : state.selectedSpark,
      }

    case "SET_SELECTED_SPARK":
      return { ...state, selectedSpark: action.payload }

    case "SET_LOADING":
      return { ...state, isLoading: action.payload }

    case "SET_ERROR":
      return { ...state, error: action.payload }

    case "SET_VIEW_MODE":
      return { ...state, viewMode: action.payload }

    case "SET_SEARCH_QUERY":
      return { ...state, searchQuery: action.payload }

    case "SET_USER_STATS":
      return { ...state, userStats: action.payload }

    case "ADD_TODO":
      return {
        ...state,
        sparks: state.sparks.map(spark =>
          spark.id === action.payload.sparkId
            ? { ...spark, todos: [...(spark.todos || []), action.payload.todo] }
            : spark
        ),
      }

    case "UPDATE_TODO":
      return {
        ...state,
        sparks: state.sparks.map(spark =>
          spark.id === action.payload.sparkId
            ? {
                ...spark,
                todos: spark.todos?.map(todo =>
                  todo.id === action.payload.todo.id ? action.payload.todo : todo
                ) || [],
              }
            : spark
        ),
      }

    case "DELETE_TODO":
      return {
        ...state,
        sparks: state.sparks.map(spark =>
          spark.id === action.payload.sparkId
            ? {
                ...spark,
                todos: spark.todos?.filter(todo => todo.id !== action.payload.todoId) || [],
              }
            : spark
        ),
      }

    case "ADD_ATTACHMENT":
      return {
        ...state,
        sparks: state.sparks.map(spark =>
          spark.id === action.payload.sparkId
            ? {
                ...spark,
                attachments: [...(spark.attachments || []), action.payload.attachment]
              }
            : spark
        ),
      }

    case "DELETE_ATTACHMENT":
      return {
        ...state,
        sparks: state.sparks.map(spark =>
          spark.id === action.payload.sparkId
            ? {
                ...spark,
                attachments: spark.attachments?.filter(att => att.id !== action.payload.attachmentId) || [],
              }
            : spark
        ),
      }

    default:
      return state
  }
}

interface SparkContextType {
  state: SparkState
  dispatch: React.Dispatch<SparkAction>
  actions: {
    loadSparks: () => Promise<void>
    createSpark: (spark: CreateSparkData) => Promise<void>
    updateSpark: (id: string, updates: Partial<Spark>) => Promise<void>
    deleteSpark: (id: string) => Promise<void>
    selectSpark: (spark: Spark | null) => void
    setViewMode: (mode: "canvas" | "kanban" | "timeline" | "connections") => void
    setSearchQuery: (query: string) => void
    addTodo: (sparkId: string, todo: Omit<Todo, "id" | "createdAt">) => Promise<void>
    updateTodo: (sparkId: string, todoId: string, updates: Partial<Todo>) => Promise<void>
    deleteTodo: (sparkId: string, todoId: string) => Promise<void>
    uploadAttachment: (sparkId: string, file: File) => Promise<void>
    deleteAttachment: (sparkId: string, attachmentId: string) => Promise<void>
    loadUserStats: () => Promise<void>
    createSparkConnection: (sparkId1: string, sparkId2: string, type: ConnectionType, metadata?: any) => Promise<void>
    updateSparkConnection: (connectionId: string, updates: { type?: ConnectionType; metadata?: any }) => Promise<void>
    deleteSparkConnection: (connectionId: string) => Promise<void>
  }
}

const SparkContext = createContext<SparkContextType | undefined>(undefined)

export function SparkProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(sparkReducer, initialState)
  const { isGuest, guestData, saveGuestData, loadGuestData } = useGuest()

  const actions = {
    loadSparks: async () => {
      dispatch({ type: "SET_LOADING", payload: true })
      try {
        if (isGuest) {
          // Load from guest storage
          const guestData = loadGuestData()
          const sparks = guestData?.sparks || []
          dispatch({ type: "SET_SPARKS", payload: sparks })
        } else {
          // Load from API
          const sparks = await sparkApi.getAll()
          dispatch({ type: "SET_SPARKS", payload: sparks })
        }
      } catch (error) {
        dispatch({ type: "SET_ERROR", payload: "Failed to load sparks" })
      } finally {
        dispatch({ type: "SET_LOADING", payload: false })
      }
    },

    loadUserStats: async () => {
      try {
        if (!isGuest) {
          const stats = await sparkApi.getUserStats()
          dispatch({ type: "SET_USER_STATS", payload: stats })
        }
      } catch (error) {
        console.error("Failed to load user stats:", error)
      }
    },

    createSpark: async (sparkData: CreateSparkData) => {
      try {
        if (isGuest) {
          // Create spark in guest storage
          const newSpark: Spark = {
            ...sparkData,
            id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId: "guest",
            createdAt: new Date(),
            updatedAt: new Date(),
            todos: [],
            attachments: [],
          }

          const currentGuestData = loadGuestData() || { sparks: [], todos: [], preferences: {} }
          const updatedSparks = [...(currentGuestData.sparks || []), newSpark]

          saveGuestData({ sparks: updatedSparks })
          dispatch({ type: "ADD_SPARK", payload: newSpark })
        } else {
          // Create spark via API
          const spark = await sparkApi.create(sparkData)
          dispatch({ type: "ADD_SPARK", payload: spark })
        }
      } catch (error) {
        console.error("SparkContext: Error creating spark:", error)
        dispatch({ type: "SET_ERROR", payload: "Failed to create spark" })
        throw error
      }
    },

    updateSpark: async (id: string, updates: Partial<Spark>) => {
      try {
        if (isGuest) {
          // Update spark in guest storage
          const currentGuestData = loadGuestData()
          const updatedSparks = currentGuestData?.sparks?.map(spark =>
            spark.id === id ? { ...spark, ...updates, updatedAt: new Date() } : spark
          ) || []

          saveGuestData({ sparks: updatedSparks })
          const updatedSpark = updatedSparks.find(spark => spark.id === id)
          if (updatedSpark) {
            dispatch({ type: "UPDATE_SPARK", payload: updatedSpark })
          }
        } else {
          // Update spark via API
          const spark = await sparkApi.update(id, updates)
          dispatch({ type: "UPDATE_SPARK", payload: spark })
        }
      } catch (error) {
        dispatch({ type: "SET_ERROR", payload: "Failed to update spark" })
      }
    },

    deleteSpark: async (id: string) => {
      try {
        if (isGuest) {
          // Delete spark from guest storage
          const currentGuestData = loadGuestData()
          const updatedSparks = currentGuestData?.sparks?.filter(spark => spark.id !== id) || []

          saveGuestData({ sparks: updatedSparks })
          dispatch({ type: "DELETE_SPARK", payload: id })
        } else {
          // Delete spark via API
          await sparkApi.delete(id)
          dispatch({ type: "DELETE_SPARK", payload: id })
        }
      } catch (error) {
        dispatch({ type: "SET_ERROR", payload: "Failed to delete spark" })
      }
    },

    selectSpark: (spark: Spark | null) => {
      dispatch({ type: "SET_SELECTED_SPARK", payload: spark })
    },

    setViewMode: (mode: "canvas" | "kanban" | "timeline" | "connections") => {
      dispatch({ type: "SET_VIEW_MODE", payload: mode })
      if (isGuest) {
        const currentGuestData = loadGuestData()
        const updatedPreferences = {
          ...(currentGuestData?.preferences || {}),
          viewMode: mode
        }
        saveGuestData({ preferences: updatedPreferences })
      }
    },

    setSearchQuery: (query: string) => {
      dispatch({ type: "SET_SEARCH_QUERY", payload: query })
    },

    addTodo: async (sparkId: string, todoData: Omit<Todo, "id" | "createdAt">) => {
      try {
        if (isGuest) {
          // Add todo to guest storage
          const newTodo: Todo = {
            ...todoData,
            id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date(),
          }

          const currentGuestData = loadGuestData()
          const updatedSparks = currentGuestData?.sparks?.map(spark =>
            spark.id === sparkId
              ? { ...spark, todos: [...(spark.todos || []), newTodo] }
              : spark
          ) || []

          saveGuestData({ sparks: updatedSparks })
          dispatch({ type: "ADD_TODO", payload: { sparkId, todo: newTodo } })
        } else {
          // Add todo via API
          const todo = await sparkApi.addTodo(sparkId, todoData)
          dispatch({ type: "ADD_TODO", payload: { sparkId, todo } })
        }
      } catch (error) {
        dispatch({ type: "SET_ERROR", payload: "Failed to add todo" })
      }
    },

    updateTodo: async (sparkId: string, todoId: string, updates: Partial<Todo>) => {
      try {
        if (isGuest) {
          // Update todo in guest storage
          const currentGuestData = loadGuestData()
          const updatedSparks = currentGuestData?.sparks?.map(spark =>
            spark.id === sparkId
              ? {
                  ...spark,
                  todos: spark.todos?.map(todo =>
                    todo.id === todoId ? { ...todo, ...updates } : todo
                  ) || [],
                }
              : spark
          ) || []

          saveGuestData({ sparks: updatedSparks })
          const updatedTodo = updatedSparks
            .find(spark => spark.id === sparkId)
            ?.todos?.find(todo => todo.id === todoId)

          if (updatedTodo) {
            dispatch({ type: "UPDATE_TODO", payload: { sparkId, todo: updatedTodo } })
          }
        } else {
          // Update todo via API
          const todo = await sparkApi.updateTodo(sparkId, todoId, updates)
          dispatch({ type: "UPDATE_TODO", payload: { sparkId, todo } })
        }
      } catch (error) {
        dispatch({ type: "SET_ERROR", payload: "Failed to update todo" })
      }
    },

    deleteTodo: async (sparkId: string, todoId: string) => {
      try {
        if (isGuest) {
          // Delete todo from guest storage
          const currentGuestData = loadGuestData()
          const updatedSparks = currentGuestData?.sparks?.map(spark =>
            spark.id === sparkId
              ? {
                  ...spark,
                  todos: spark.todos?.filter(todo => todo.id !== todoId) || [],
                }
              : spark
          ) || []

          saveGuestData({ sparks: updatedSparks })
          dispatch({ type: "DELETE_TODO", payload: { sparkId, todoId } })
        } else {
          // Delete todo via API
          await sparkApi.deleteTodo(sparkId, todoId)
          dispatch({ type: "DELETE_TODO", payload: { sparkId, todoId } })
        }
      } catch (error) {
        dispatch({ type: "SET_ERROR", payload: "Failed to delete todo" })
      }
    },

    uploadAttachment: async (sparkId: string, file: File) => {
      try {
        if (isGuest) {
          // For guest mode, create a simple attachment object
          const newAttachment: Attachment = {
            id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            sparkId,
            filename: file.name,
            url: URL.createObjectURL(file), // Create a local URL for the file
            type: AttachmentType.FILE,
            size: file.size,
            createdAt: new Date(),
          }

          const currentGuestData = loadGuestData()
          const updatedSparks = currentGuestData?.sparks?.map(spark =>
            spark.id === sparkId
              ? {
                  ...spark,
                  attachments: [...(spark.attachments || []), newAttachment]
                }
              : spark
          ) || []

          saveGuestData({ sparks: updatedSparks })
          dispatch({ type: "ADD_ATTACHMENT", payload: { sparkId, attachment: newAttachment } })
        } else {
          // Upload attachment via API
          const formData = new FormData()
          formData.append("file", file)
          formData.append("type", "FILE")

          const response = await fetch(`/api/sparks/${sparkId}/attachments`, {
            method: "POST",
            body: formData,
          })

          if (!response.ok) {
            throw new Error("Failed to upload attachment")
          }

          const attachment = await response.json()
          dispatch({ type: "ADD_ATTACHMENT", payload: { sparkId, attachment } })
        }
      } catch (error) {
        dispatch({ type: "SET_ERROR", payload: "Failed to upload attachment" })
      }
    },

    deleteAttachment: async (sparkId: string, attachmentId: string) => {
      try {
        if (isGuest) {
          // Delete attachment from guest storage
          const currentGuestData = loadGuestData()
          const updatedSparks = currentGuestData?.sparks?.map(spark =>
            spark.id === sparkId
              ? {
                  ...spark,
                  attachments: spark.attachments?.filter(att => att.id !== attachmentId) || [],
                }
              : spark
          ) || []

          saveGuestData({ sparks: updatedSparks })
          dispatch({ type: "DELETE_ATTACHMENT", payload: { sparkId, attachmentId } })
        } else {
          // Delete attachment via API
          await fetch(`/api/attachments/${attachmentId}`, {
            method: "DELETE",
          })
          dispatch({ type: "DELETE_ATTACHMENT", payload: { sparkId, attachmentId } })
        }
      } catch (error) {
        dispatch({ type: "SET_ERROR", payload: "Failed to delete attachment" })
      }
    },

    createSparkConnection: async (sparkId1: string, sparkId2: string, type: ConnectionType, metadata?: any) => {
      try {
        if (isGuest) {
          // Create connection in guest storage
          const newConnection: SparkConnection = {
            id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            sparkId1,
            sparkId2,
            type,
            metadata,
            createdAt: new Date(),
          }

          const currentGuestData = loadGuestData()
          const updatedSparks = currentGuestData?.sparks?.map(spark => {
            if (spark.id === sparkId1) {
              return {
                ...spark,
                connections: [...(spark.connections || []), newConnection]
              }
            }
            return spark
          }) || []

          saveGuestData({ sparks: updatedSparks })
          dispatch({ type: "SET_SPARKS", payload: updatedSparks })
        } else {
          // Create connection via API
          const connection = await sparkApi.createConnection(sparkId1, sparkId2, type, metadata)
          await actions.loadSparks() // Reload to get updated connections
        }
      } catch (error) {
        dispatch({ type: "SET_ERROR", payload: "Failed to create connection" })
      }
    },

    updateSparkConnection: async (connectionId: string, updates: { type?: ConnectionType; metadata?: any }) => {
      try {
        if (isGuest) {
          // Update connection in guest storage
          const currentGuestData = loadGuestData()
          const updatedSparks = currentGuestData?.sparks?.map(spark => ({
            ...spark,
            connections: spark.connections?.map(conn =>
              conn.id === connectionId ? { ...conn, ...updates } : conn
            ) || []
          })) || []

          saveGuestData({ sparks: updatedSparks })
          dispatch({ type: "SET_SPARKS", payload: updatedSparks })
        } else {
          // Update connection via API
          await sparkApi.updateConnection(connectionId, updates)
          await actions.loadSparks() // Reload to get updated connections
        }
      } catch (error) {
        dispatch({ type: "SET_ERROR", payload: "Failed to update connection" })
      }
    },

    deleteSparkConnection: async (connectionId: string) => {
      try {
        if (isGuest) {
          // Delete connection from guest storage
          const currentGuestData = loadGuestData()
          const updatedSparks = currentGuestData?.sparks?.map(spark => ({
            ...spark,
            connections: spark.connections?.filter(conn => conn.id !== connectionId) || []
          })) || []

          saveGuestData({ sparks: updatedSparks })
          dispatch({ type: "SET_SPARKS", payload: updatedSparks })
        } else {
          // Delete connection via API
          await sparkApi.deleteConnection(connectionId)
          await actions.loadSparks() // Reload to get updated connections
        }
      } catch (error) {
        dispatch({ type: "SET_ERROR", payload: "Failed to delete connection" })
      }
    },
  }

  useEffect(() => {
    actions.loadSparks()
  }, [isGuest])

  return (
    <SparkContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </SparkContext.Provider>
  )
}

export function useSpark() {
  const context = useContext(SparkContext)
  if (context === undefined) {
    throw new Error("useSpark must be used within a SparkProvider")
  }
  return context
}
