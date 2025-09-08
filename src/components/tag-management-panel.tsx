"use client"

import { useState } from 'react'
import { useTags } from '@/hooks/use-tags'
import { Tag, CreateTagData, UpdateTagData } from '@/types/tag'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { 
  Plus, 
  Edit, 
  Trash2, 
  MoreVertical, 
  Tag as TagIcon,
  Palette,
  BarChart3,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Hash
} from 'lucide-react'

interface TagTreeItemProps {
  tag: Tag
  level: number
  onEdit: (tag: Tag) => void
  onDelete: (tag: Tag) => void
  onToggleExpanded: (tagId: string) => void
  expandedTags: Set<string>
}

function TagTreeItem({ tag, level, onEdit, onDelete, onToggleExpanded, expandedTags }: TagTreeItemProps) {
  const hasChildren = tag.children && tag.children.length > 0
  const isExpanded = expandedTags.has(tag.id)

  return (
    <div className="select-none">
      <div 
        className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent/50 transition-colors group"
        style={{ marginLeft: `${level * 20}px` }}
      >
        {hasChildren ? (
          <Button
            variant="ghost"
            size="sm"
            className="w-4 h-4 p-0"
            onClick={() => onToggleExpanded(tag.id)}
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </Button>
        ) : (
          <div className="w-4" />
        )}
        
        <div 
          className="w-4 h-4 rounded border"
          style={{ backgroundColor: tag.color }}
        />
        
        {hasChildren ? (
          isExpanded ? (
            <FolderOpen className="w-4 h-4 text-muted-foreground" />
          ) : (
            <Folder className="w-4 h-4 text-muted-foreground" />
          )
        ) : (
          <Hash className="w-4 h-4 text-muted-foreground" />
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{tag.name}</span>
            {hasChildren && (
              <Badge variant="secondary" className="text-xs">
                {tag._count?.children || 0}
              </Badge>
            )}
          </div>
          {tag.description && (
            <p className="text-xs text-muted-foreground truncate">{tag.description}</p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(tag)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onDelete(tag)}
              className="text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {hasChildren && isExpanded && tag.children && (
        <div>
          {tag.children.map((child) => (
            <TagTreeItem
              key={child.id}
              tag={child}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleExpanded={onToggleExpanded}
              expandedTags={expandedTags}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TagForm({ 
  tag, 
  tags, 
  onSubmit, 
  onCancel 
}: { 
  tag?: Tag
  tags: Tag[]
  onSubmit: (data: CreateTagData | UpdateTagData) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({
    name: tag?.name || '',
    description: tag?.description || '',
    color: tag?.color || '#10b981',
    parentTagId: tag?.parentTagId || '',
  })

  const availableParents = tags.filter(t => t.id !== tag?.id && !isDescendant(tag?.id || '', t))

  function isDescendant(ancestorId: string, tag: Tag): boolean {
    if (!tag.children) return false
    
    for (const child of tag.children) {
      if (child.id === ancestorId || isDescendant(ancestorId, child)) {
        return true
      }
    }
    return false
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      parentTagId: formData.parentTagId || undefined
    })
  }

  const colorOptions = [
    '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#f59e0b',
    '#06b6d4', '#84cc16', '#ec4899', '#6366f1', '#f97316'
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Tag name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Optional description"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex gap-2 flex-wrap">
          {colorOptions.map((color) => (
            <button
              key={color}
              type="button"
              className={`w-8 h-8 rounded border-2 ${
                formData.color === color ? 'border-foreground' : 'border-border'
              }`}
              style={{ backgroundColor: color }}
              onClick={() => setFormData(prev => ({ ...prev, color }))}
            />
          ))}
        </div>
        <Input
          value={formData.color}
          onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
          placeholder="#10b981"
          pattern="^#[0-9A-Fa-f]{6}$"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="parent">Parent Tag</Label>
        <Select
          value={formData.parentTagId}
          onValueChange={(value) => setFormData(prev => ({ ...prev, parentTagId: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="No parent (root tag)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">No parent (root tag)</SelectItem>
            {availableParents.map((parent) => (
              <SelectItem key={parent.id} value={parent.id}>
                {parent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {tag ? 'Update' : 'Create'} Tag
        </Button>
      </div>
    </form>
  )
}

export function TagManagementPanel() {
  const { tags, stats, loading, createTag, updateTag, deleteTag } = useTags()
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set())
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  const toggleExpanded = (tagId: string) => {
    setExpandedTags(prev => {
      const next = new Set(prev)
      if (next.has(tagId)) {
        next.delete(tagId)
      } else {
        next.add(tagId)
      }
      return next
    })
  }

  const handleCreateTag = async (data: CreateTagData) => {
    const success = await createTag(data)
    if (success) {
      setIsCreateDialogOpen(false)
    }
  }

  const handleUpdateTag = async (data: UpdateTagData) => {
    if (editingTag) {
      const success = await updateTag(editingTag.id, data)
      if (success) {
        setEditingTag(null)
      }
    }
  }

  const handleDeleteTag = async () => {
    if (deletingTag) {
      const success = await deleteTag(deletingTag.id)
      if (success) {
        setDeletingTag(null)
      }
    }
  }

  const rootTags = tags.filter(tag => !tag.parentTagId)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tag Management</h1>
          <p className="text-muted-foreground">Organize your tags with hierarchical relationships</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Tag
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Tag</DialogTitle>
            </DialogHeader>
            <TagForm
              tags={tags}
              onSubmit={handleCreateTag}
              onCancel={() => setIsCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="hierarchy" className="space-y-4">
        <TabsList>
          <TabsTrigger value="hierarchy">
            <TagIcon className="w-4 h-4 mr-2" />
            Hierarchy
          </TabsTrigger>
          <TabsTrigger value="all">
            <Palette className="w-4 h-4 mr-2" />
            All Tags
          </TabsTrigger>
          <TabsTrigger value="stats">
            <BarChart3 className="w-4 h-4 mr-2" />
            Statistics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hierarchy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tag Hierarchy</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading tags...</div>
              ) : rootTags.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No tags found. Create your first tag to get started.
                </div>
              ) : (
                <div className="space-y-1">
                  {rootTags.map((tag) => (
                    <TagTreeItem
                      key={tag.id}
                      tag={tag}
                      level={0}
                      onEdit={setEditingTag}
                      onDelete={setDeletingTag}
                      onToggleExpanded={toggleExpanded}
                      expandedTags={expandedTags}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Tags</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading tags...</div>
              ) : tags.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No tags found. Create your first tag to get started.
                </div>
              ) : (
                <div className="grid gap-3">
                  {tags.map((tag) => (
                    <div key={tag.id} className="flex items-center gap-3 p-3 rounded-lg border">
                      <div 
                        className="w-4 h-4 rounded border flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">{tag.name}</h3>
                          {tag.parent && (
                            <Badge variant="outline" className="text-xs">
                              {tag.parent.name}
                            </Badge>
                          )}
                          {tag._count?.children && tag._count.children > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {tag._count.children} children
                            </Badge>
                          )}
                        </div>
                        {tag.description && (
                          <p className="text-sm text-muted-foreground truncate">{tag.description}</p>
                        )}
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingTag(tag)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setDeletingTag(tag)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          {stats && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Tags</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalTags}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Root Tags</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.rootTags}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Max Depth</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.maxDepth}</div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2 lg:col-span-3">
                <CardHeader>
                  <CardTitle>Color Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.colorStats.map((stat, index) => (
                      <div key={stat.color} className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded border flex-shrink-0"
                          style={{ backgroundColor: stat.color }}
                        />
                        <div className="flex-1">
                          <div className="flex justify-between text-sm">
                            <span>{stat.color}</span>
                            <span>{stat.count} tags</span>
                          </div>
                          <Progress 
                            value={(stat.count / stats.totalTags) * 100} 
                            className="h-1"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editingTag} onOpenChange={() => setEditingTag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
          </DialogHeader>
          {editingTag && (
            <TagForm
              tag={editingTag}
              tags={tags}
              onSubmit={handleUpdateTag}
              onCancel={() => setEditingTag(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingTag} onOpenChange={() => setDeletingTag(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingTag?.name}"? 
              {deletingTag?._count?.children && deletingTag._count.children > 0 && (
                <> This tag has {deletingTag._count.children} child tags that will become root tags.</>
              )}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTag} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}