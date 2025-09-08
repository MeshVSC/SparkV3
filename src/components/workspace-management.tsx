"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/hooks/use-toast"
import { 
  Plus, 
  Settings, 
  UserPlus, 
  Crown, 
  Edit3, 
  Eye, 
  Trash2,
  Mail,
  MoreHorizontal,
  Save,
  X
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { socketClient } from "@/lib/socket-client"

interface User {
  id: string
  name: string | null
  email: string
  avatar: string | null
}

interface WorkspaceMember {
  id: string
  role: 'OWNER' | 'EDITOR' | 'VIEWER'
  createdAt: string
  user: User
}

interface Workspace {
  id: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
  users: WorkspaceMember[]
}

export function WorkspaceManagement() {
  const { data: session } = useSession()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)
  const [isEditingWorkspace, setIsEditingWorkspace] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMember | null>(null)

  // Form states
  const [newWorkspace, setNewWorkspace] = useState({ name: "", description: "" })
  const [invitation, setInvitation] = useState({ email: "", role: "VIEWER" as const })
  const [editedWorkspace, setEditedWorkspace] = useState({ name: "", description: "" })

  useEffect(() => {
    if (session?.user?.id) {
      fetchWorkspaces()
    }
  }, [session])

  useEffect(() => {
    // Set up real-time listeners
    const handleWorkspaceUpdate = () => {
      fetchWorkspaces()
    }

    socketClient.addEventListener('workspace_invitation', handleWorkspaceUpdate)
    socketClient.addEventListener('role_updated', handleWorkspaceUpdate)
    socketClient.addEventListener('workspace_removed', handleWorkspaceUpdate)

    return () => {
      socketClient.removeEventListener('workspace_invitation', handleWorkspaceUpdate)
      socketClient.removeEventListener('role_updated', handleWorkspaceUpdate)
      socketClient.removeEventListener('workspace_removed', handleWorkspaceUpdate)
    }
  }, [])

  const fetchWorkspaces = async () => {
    try {
      const response = await fetch("/api/workspaces")
      if (!response.ok) throw new Error("Failed to fetch workspaces")
      const data = await response.json()
      setWorkspaces(data)
      if (!selectedWorkspace && data.length > 0) {
        setSelectedWorkspace(data[0])
      }
    } catch (error) {
      console.error("Error fetching workspaces:", error)
      toast({ title: "Error", description: "Failed to load workspaces", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const createWorkspace = async () => {
    if (!newWorkspace.name.trim()) return

    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newWorkspace)
      })

      if (!response.ok) throw new Error("Failed to create workspace")
      
      const workspace = await response.json()
      setWorkspaces(prev => [workspace, ...prev])
      setSelectedWorkspace(workspace)
      setNewWorkspace({ name: "", description: "" })
      setIsCreateDialogOpen(false)
      toast({ title: "Success", description: "Workspace created successfully" })
    } catch (error) {
      console.error("Error creating workspace:", error)
      toast({ title: "Error", description: "Failed to create workspace", variant: "destructive" })
    }
  }

  const updateWorkspace = async () => {
    if (!selectedWorkspace || !editedWorkspace.name.trim()) return

    try {
      const response = await fetch(`/api/workspaces/${selectedWorkspace.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editedWorkspace)
      })

      if (!response.ok) throw new Error("Failed to update workspace")
      
      const updatedWorkspace = await response.json()
      setWorkspaces(prev => prev.map(w => w.id === updatedWorkspace.id ? updatedWorkspace : w))
      setSelectedWorkspace(updatedWorkspace)
      setIsEditingWorkspace(false)
      toast({ title: "Success", description: "Workspace updated successfully" })
    } catch (error) {
      console.error("Error updating workspace:", error)
      toast({ title: "Error", description: "Failed to update workspace", variant: "destructive" })
    }
  }

  const inviteMember = async () => {
    if (!selectedWorkspace || !invitation.email.trim()) return

    try {
      const response = await fetch(`/api/workspaces/${selectedWorkspace.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invitation)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to invite member")
      }
      
      const newMember = await response.json()
      setSelectedWorkspace(prev => prev ? {
        ...prev,
        users: [...prev.users, newMember]
      } : null)
      
      setInvitation({ email: "", role: "VIEWER" })
      setIsInviteDialogOpen(false)
      toast({ title: "Success", description: "Member invited successfully" })
    } catch (error: any) {
      console.error("Error inviting member:", error)
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const updateMemberRole = async (memberId: string, userId: string, newRole: string) => {
    if (!selectedWorkspace) return

    try {
      const response = await fetch(`/api/workspaces/${selectedWorkspace.id}/members/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole })
      })

      if (!response.ok) throw new Error("Failed to update member role")
      
      const updatedMember = await response.json()
      setSelectedWorkspace(prev => prev ? {
        ...prev,
        users: prev.users.map(member => 
          member.id === memberId ? { ...member, role: newRole as any } : member
        )
      } : null)
      
      toast({ title: "Success", description: "Member role updated successfully" })
    } catch (error) {
      console.error("Error updating member role:", error)
      toast({ title: "Error", description: "Failed to update member role", variant: "destructive" })
    }
  }

  const removeMember = async (member: WorkspaceMember) => {
    if (!selectedWorkspace) return

    try {
      const response = await fetch(`/api/workspaces/${selectedWorkspace.id}/members/${member.user.id}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to remove member")
      }
      
      setSelectedWorkspace(prev => prev ? {
        ...prev,
        users: prev.users.filter(u => u.id !== member.id)
      } : null)
      
      setMemberToRemove(null)
      toast({ title: "Success", description: "Member removed successfully" })
    } catch (error: any) {
      console.error("Error removing member:", error)
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case "OWNER": return "bg-purple-100 text-purple-800 border-purple-200"
      case "EDITOR": return "bg-blue-100 text-blue-800 border-blue-200"
      case "VIEWER": return "bg-gray-100 text-gray-800 border-gray-200"
      default: return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "OWNER": return <Crown className="h-3 w-3" />
      case "EDITOR": return <Edit3 className="h-3 w-3" />
      case "VIEWER": return <Eye className="h-3 w-3" />
      default: return <Eye className="h-3 w-3" />
    }
  }

  const canModifyMember = (targetMember: WorkspaceMember) => {
    if (!selectedWorkspace || !session?.user?.id) return false
    
    const currentUser = selectedWorkspace.users.find(u => u.user.id === session.user.id)
    if (!currentUser) return false
    
    // Users can remove themselves
    if (targetMember.user.id === session.user.id) return true
    
    // Owners can modify anyone
    if (currentUser.role === "OWNER") return true
    
    // Editors can modify viewers
    if (currentUser.role === "EDITOR" && targetMember.role === "VIEWER") return true
    
    return false
  }

  if (isLoading) {
    return <div className="p-6">Loading workspaces...</div>
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Workspace Management</h1>
          <p className="text-muted-foreground">Manage your workspaces and collaborate with team members</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Workspace
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Workspace</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Workspace Name</Label>
                <Input
                  id="name"
                  value={newWorkspace.name}
                  onChange={(e) => setNewWorkspace(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter workspace name"
                />
              </div>
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={newWorkspace.description}
                  onChange={(e) => setNewWorkspace(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe your workspace"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createWorkspace} disabled={!newWorkspace.name.trim()}>
                  Create Workspace
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workspace List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Your Workspaces</h2>
          {workspaces.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground mb-4">No workspaces yet</p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Workspace
                </Button>
              </CardContent>
            </Card>
          ) : (
            workspaces.map((workspace) => (
              <Card 
                key={workspace.id}
                className={`cursor-pointer transition-colors ${
                  selectedWorkspace?.id === workspace.id ? "ring-2 ring-primary" : "hover:bg-accent/50"
                }`}
                onClick={() => setSelectedWorkspace(workspace)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium">{workspace.name}</h3>
                      {workspace.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {workspace.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {workspace.users.length} member{workspace.users.length !== 1 ? 's' : ''}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {workspace.users.find(u => u.user.id === session?.user?.id)?.role || 'Member'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Workspace Details */}
        <div className="lg:col-span-2">
          {selectedWorkspace ? (
            <Tabs defaultValue="members" className="space-y-4">
              <TabsList>
                <TabsTrigger value="members">Members</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="members" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Members</h2>
                  <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <UserPlus className="h-4 w-4 mr-2" />
                        Invite Member
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Invite Member to {selectedWorkspace.name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="email">Email Address</Label>
                          <Input
                            id="email"
                            type="email"
                            value={invitation.email}
                            onChange={(e) => setInvitation(prev => ({ ...prev, email: e.target.value }))}
                            placeholder="Enter email address"
                          />
                        </div>
                        <div>
                          <Label htmlFor="role">Role</Label>
                          <Select value={invitation.role} onValueChange={(value: any) => setInvitation(prev => ({ ...prev, role: value }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="VIEWER">Viewer</SelectItem>
                              <SelectItem value="EDITOR">Editor</SelectItem>
                              <SelectItem value="OWNER">Owner</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button onClick={inviteMember} disabled={!invitation.email.trim()}>
                            <Mail className="h-4 w-4 mr-2" />
                            Send Invitation
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-2">
                  {selectedWorkspace.users.map((member) => (
                    <Card key={member.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={member.user.avatar || undefined} />
                              <AvatarFallback>
                                {member.user.name?.charAt(0) || member.user.email.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">
                                {member.user.name || member.user.email}
                                {member.user.id === session?.user?.id && (
                                  <span className="text-muted-foreground text-sm ml-2">(You)</span>
                                )}
                              </p>
                              <p className="text-sm text-muted-foreground">{member.user.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getRoleColor(member.role)}>
                              {getRoleIcon(member.role)}
                              {member.role.toLowerCase()}
                            </Badge>
                            {canModifyMember(member) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {member.user.id !== session?.user?.id && (
                                    <>
                                      <DropdownMenuItem onClick={() => updateMemberRole(member.id, member.user.id, "VIEWER")}>
                                        Change to Viewer
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => updateMemberRole(member.id, member.user.id, "EDITOR")}>
                                        Change to Editor
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => updateMemberRole(member.id, member.user.id, "OWNER")}>
                                        Change to Owner
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => setMemberToRemove(member)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    {member.user.id === session?.user?.id ? "Leave Workspace" : "Remove Member"}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Workspace Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isEditingWorkspace ? (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="editName">Workspace Name</Label>
                          <Input
                            id="editName"
                            value={editedWorkspace.name}
                            onChange={(e) => setEditedWorkspace(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="editDescription">Description</Label>
                          <Textarea
                            id="editDescription"
                            value={editedWorkspace.description}
                            onChange={(e) => setEditedWorkspace(prev => ({ ...prev, description: e.target.value }))}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={updateWorkspace} disabled={!editedWorkspace.name.trim()}>
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </Button>
                          <Button variant="outline" onClick={() => setIsEditingWorkspace(false)}>
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <Label>Workspace Name</Label>
                          <p className="text-lg font-medium">{selectedWorkspace.name}</p>
                        </div>
                        <div>
                          <Label>Description</Label>
                          <p className="text-muted-foreground">
                            {selectedWorkspace.description || "No description provided"}
                          </p>
                        </div>
                        <div>
                          <Label>Created</Label>
                          <p className="text-muted-foreground">
                            {new Date(selectedWorkspace.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button 
                          onClick={() => {
                            setEditedWorkspace({
                              name: selectedWorkspace.name,
                              description: selectedWorkspace.description || ""
                            })
                            setIsEditingWorkspace(true)
                          }}
                        >
                          <Edit3 className="h-4 w-4 mr-2" />
                          Edit Workspace
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Select a workspace to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Remove Member Dialog */}
      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {memberToRemove?.user.id === session?.user?.id ? "Leave Workspace" : "Remove Member"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {memberToRemove?.user.id === session?.user?.id 
                ? "Are you sure you want to leave this workspace? You will lose access to all workspace content."
                : `Are you sure you want to remove ${memberToRemove?.user.name || memberToRemove?.user.email} from this workspace?`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => memberToRemove && removeMember(memberToRemove)}
            >
              {memberToRemove?.user.id === session?.user?.id ? "Leave" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}