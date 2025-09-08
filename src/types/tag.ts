export interface Tag {
  id: string
  name: string
  description?: string
  color: string
  parentTagId?: string
  createdAt: Date
  updatedAt: Date
  parent?: Tag
  children?: Tag[]
  _count?: {
    children: number
  }
}

export interface TagStats {
  totalTags: number
  rootTags: number
  parentTags: number
  leafTags: number
  maxDepth: number
  colorStats: Array<{
    color: string
    count: number
  }>
  recentActivity: Array<{
    id: string
    name: string
    createdAt: Date
    updatedAt: Date
  }>
}

export interface CreateTagData {
  name: string
  description?: string
  color?: string
  parentTagId?: string
}

export interface UpdateTagData {
  name?: string
  description?: string
  color?: string
  parentTagId?: string
}