import { Spark, Todo, CreateSparkData, Attachment, SparkConnection, ConnectionType } from "@/types/spark"

class SparkAPI {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`/api${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      credentials: "include", // Include cookies for authentication
      ...options,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error || `HTTP error! status: ${response.status}`
      throw new Error(errorMessage)
    }

    return response.json()
  }

  async getAll(): Promise<Spark[]> {
    return this.request<Spark[]>("/sparks")
  }

  async getById(id: string): Promise<Spark> {
    return this.request<Spark>(`/sparks/${id}`)
  }

  async create(sparkData: CreateSparkData): Promise<Spark> {
    return this.request<Spark>("/sparks", {
      method: "POST",
      body: JSON.stringify(sparkData),
    })
  }

  async update(id: string, updates: Partial<Spark>): Promise<Spark> {
    return this.request<Spark>(`/sparks/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    })
  }

  async delete(id: string): Promise<void> {
    return this.request<void>(`/sparks/${id}`, {
      method: "DELETE",
    })
  }

  async updatePosition(id: string, position: { x: number; y: number }): Promise<Spark> {
    return this.request<Spark>(`/sparks/${id}/position`, {
      method: "PUT",
      body: JSON.stringify(position),
    })
  }

  async addTodo(sparkId: string, todoData: Omit<Todo, "id" | "createdAt">): Promise<Todo> {
    return this.request<Todo>(`/sparks/${sparkId}/todos`, {
      method: "POST",
      body: JSON.stringify(todoData),
    })
  }

  async updateTodo(sparkId: string, todoId: string, updates: Partial<Todo>): Promise<Todo> {
    return this.request<Todo>(`/sparks/${sparkId}/todos/${todoId}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    })
  }

  async deleteTodo(sparkId: string, todoId: string): Promise<void> {
    return this.request<void>(`/sparks/${sparkId}/todos/${todoId}`, {
      method: "DELETE",
    })
  }

  async search(query: string): Promise<Spark[]> {
    return this.request<Spark[]>(`/search?q=${encodeURIComponent(query)}`)
  }

  async getUserStats(): Promise<any> {
    return this.request<any>("/user/stats")
  }

  async getAttachments(sparkId: string): Promise<Attachment[]> {
    return this.request<Attachment[]>(`/sparks/${sparkId}/attachments`)
  }

  async uploadAttachment(sparkId: string, file: File): Promise<Attachment> {
    const formData = new FormData()
    formData.append("file", file)
    
    return this.request<Attachment>(`/sparks/${sparkId}/attachments`, {
      method: "POST",
      body: formData,
      headers: {}, // Let browser set Content-Type for FormData
    })
  }

  async deleteAttachment(sparkId: string, attachmentId: string): Promise<void> {
    return this.request<void>(`/sparks/${sparkId}/attachments/${attachmentId}`, {
      method: "DELETE",
    })
  }

  async createConnection(sparkId1: string, sparkId2: string, type: ConnectionType, metadata?: any): Promise<SparkConnection> {
    return this.request<SparkConnection>("/connections", {
      method: "POST",
      body: JSON.stringify({
        sparkId1,
        sparkId2,
        type,
        metadata,
      }),
    })
  }

  async updateConnection(connectionId: string, updates: { type?: ConnectionType; metadata?: any }): Promise<SparkConnection> {
    return this.request<SparkConnection>(`/connections/${connectionId}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    })
  }

  async deleteConnection(connectionId: string): Promise<void> {
    return this.request<void>(`/connections/${connectionId}`, {
      method: "DELETE",
    })
  }

  async getConnections(): Promise<SparkConnection[]> {
    return this.request<SparkConnection[]>("/connections")
  }
}

export const sparkApi = new SparkAPI()