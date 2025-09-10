"use client"

import { useState, useMemo, useCallback } from "react"
import { SparkConnection, ConnectionType, Spark } from "@/types/spark"
import { useSpark } from "@/contexts/spark-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  Trash2, 
  Eye, 
  Edit, 
  Link, 
  Unlink, 
  MoreVertical,
  CheckSquare,
  Square,
  ChevronUp,
  ChevronDown
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ConnectionWithSparks extends SparkConnection {
  spark1?: Spark
  spark2?: Spark
}

interface FilterState {
  connectionType: ConnectionType | "ALL"
  sparkStatus: string | "ALL"
  dateRange: string | "ALL"
}

interface SortState {
  field: keyof SparkConnection | "spark1Title" | "spark2Title"
  direction: "asc" | "desc"
}

const connectionTypeColors = {
  DEPENDS_ON: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  RELATED_TO: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", 
  INSPIRES: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  CONFLICTS_WITH: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
}

const connectionTypeLabels = {
  DEPENDS_ON: "Depends On",
  RELATED_TO: "Related To", 
  INSPIRES: "Inspires",
  CONFLICTS_WITH: "Conflicts With",
}

export function ConnectionManagementPanel() {
  const { state, actions } = useSpark()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedConnections, setSelectedConnections] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<FilterState>({
    connectionType: "ALL",
    sparkStatus: "ALL", 
    dateRange: "ALL"
  })
  const [sort, setSort] = useState<SortState>({
    field: "createdAt",
    direction: "desc"
  })
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false)

  // Get all connections with associated spark data
  const connectionsWithSparks = useMemo((): ConnectionWithSparks[] => {
    const allConnections: ConnectionWithSparks[] = []
    
    state.sparks.forEach(spark => {
      if (spark.connections) {
        spark.connections.forEach(connection => {
          const spark1 = state.sparks.find(s => s.id === connection.sparkId1)
          const spark2 = state.sparks.find(s => s.id === connection.sparkId2)
          
          // Avoid duplicates by only adding if this spark is sparkId1 or if sparkId1 doesn't exist in our sparks
          if (spark.id === connection.sparkId1 || !spark1) {
            allConnections.push({
              ...connection,
              spark1,
              spark2
            })
          }
        })
      }
    })

    return allConnections
  }, [state.sparks])

  // Apply search filter
  const searchFilteredConnections = useMemo(() => {
    if (!searchQuery.trim()) return connectionsWithSparks
    
    const query = searchQuery.toLowerCase()
    return connectionsWithSparks.filter(connection => 
      connection.spark1?.title?.toLowerCase().includes(query) ||
      connection.spark2?.title?.toLowerCase().includes(query) ||
      connectionTypeLabels[connection.type].toLowerCase().includes(query)
    )
  }, [connectionsWithSparks, searchQuery])

  // Apply other filters
  const filteredConnections = useMemo(() => {
    let filtered = searchFilteredConnections

    // Connection type filter
    if (filters.connectionType !== "ALL") {
      filtered = filtered.filter(conn => conn.type === filters.connectionType)
    }

    // Spark status filter  
    if (filters.sparkStatus !== "ALL") {
      filtered = filtered.filter(conn => 
        conn.spark1?.status === filters.sparkStatus || 
        conn.spark2?.status === filters.sparkStatus
      )
    }

    // Date range filter
    if (filters.dateRange !== "ALL") {
      const now = new Date()
      const filterDate = new Date()
      
      switch (filters.dateRange) {
        case "TODAY":
          filterDate.setHours(0, 0, 0, 0)
          break
        case "WEEK":
          filterDate.setDate(now.getDate() - 7)
          break
        case "MONTH":
          filterDate.setMonth(now.getMonth() - 1)
          break
        default:
          return filtered
      }
      
      filtered = filtered.filter(conn => new Date(conn.createdAt) >= filterDate)
    }

    return filtered
  }, [searchFilteredConnections, filters])

  // Apply sorting
  const sortedConnections = useMemo(() => {
    const sorted = [...filteredConnections]
    
    sorted.sort((a, b) => {
      let aValue: any
      let bValue: any
      
      switch (sort.field) {
        case "spark1Title":
          aValue = a.spark1?.title || ""
          bValue = b.spark1?.title || ""
          break
        case "spark2Title":
          aValue = a.spark2?.title || ""
          bValue = b.spark2?.title || ""
          break
        case "type":
          aValue = connectionTypeLabels[a.type]
          bValue = connectionTypeLabels[b.type]
          break
        case "createdAt":
          aValue = new Date(a.createdAt).getTime()
          bValue = new Date(b.createdAt).getTime()
          break
        default:
          aValue = (a as any)[sort.field] || ""
          bValue = (b as any)[sort.field] || ""
      }
      
      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      return sort.direction === "asc" ? comparison : -comparison
    })
    
    return sorted
  }, [filteredConnections, sort])

  // Selection handlers
  const toggleConnection = useCallback((connectionId: string) => {
    setSelectedConnections(prev => {
      const newSelection = new Set(prev)
      if (newSelection.has(connectionId)) {
        newSelection.delete(connectionId)
      } else {
        newSelection.add(connectionId)
      }
      return newSelection
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelectedConnections(prev => 
      prev.size === sortedConnections.length 
        ? new Set() 
        : new Set(sortedConnections.map(c => c.id))
    )
  }, [sortedConnections])

  const clearSelection = useCallback(() => {
    setSelectedConnections(new Set())
  }, [])

  // Bulk operations
  const handleBulkDelete = useCallback(async () => {
    const connectionsToDelete = Array.from(selectedConnections)
    
    try {
      // TODO: Implement bulk delete connection API call
      await Promise.all(connectionsToDelete.map(id => 
        actions.deleteSparkConnection?.(id) // Assuming this method exists
      ))
      clearSelection()
    } catch (error) {
      console.error("Failed to delete connections:", error)
    }
  }, [selectedConnections, actions, clearSelection])

  const handleBulkChangeType = useCallback(async (newType: ConnectionType) => {
    const connectionsToUpdate = Array.from(selectedConnections)
    
    try {
      // TODO: Implement bulk update connection type API call
      await Promise.all(connectionsToUpdate.map(id => 
        actions.updateSparkConnection?.(id, { type: newType }) // Assuming this method exists
      ))
      clearSelection()
    } catch (error) {
      console.error("Failed to update connection types:", error)
    }
  }, [selectedConnections, actions, clearSelection])

  // Sort handler
  const handleSort = useCallback((field: SortState["field"]) => {
    setSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc"
    }))
  }, [])

  const SortButton = ({ field, children }: { field: SortState["field"], children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 p-2 justify-start font-medium"
      onClick={() => handleSort(field)}
    >
      {children}
      {sort.field === field && (
        sort.direction === "asc" ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />
      )}
    </Button>
  )

  const isAllSelected = selectedConnections.size === sortedConnections.length && sortedConnections.length > 0
  const isPartiallySelected = selectedConnections.size > 0 && selectedConnections.size < sortedConnections.length

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link className="h-5 w-5" />
          Connection Management
          <Badge variant="outline" className="ml-auto">
            {sortedConnections.length} connections
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search connections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
            className="shrink-0"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters {isFilterPanelOpen ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />}
          </Button>
        </div>

        {/* Filter Panel */}
        {isFilterPanelOpen && (
          <Card className="p-4 bg-muted/50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Connection Type</label>
                <Select value={filters.connectionType} onValueChange={(value) => setFilters(prev => ({ ...prev, connectionType: value as any }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Types</SelectItem>
                    {Object.entries(connectionTypeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Spark Status</label>
                <Select value={filters.sparkStatus} onValueChange={(value) => setFilters(prev => ({ ...prev, sparkStatus: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="SEEDLING">Seedling</SelectItem>
                    <SelectItem value="SAPLING">Sapling</SelectItem>
                    <SelectItem value="TREE">Tree</SelectItem>
                    <SelectItem value="FOREST">Forest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Created</label>
                <Select value={filters.dateRange} onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Time</SelectItem>
                    <SelectItem value="TODAY">Today</SelectItem>
                    <SelectItem value="WEEK">This Week</SelectItem>
                    <SelectItem value="MONTH">This Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        )}

        {/* Bulk Operations */}
        {selectedConnections.size > 0 && (
          <Card className="p-3 bg-primary/5 border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">
                  {selectedConnections.size} connection{selectedConnections.size !== 1 ? 's' : ''} selected
                </span>
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  Clear selection
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      Change Type
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuLabel>Change connection type to:</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {Object.entries(connectionTypeLabels).map(([key, label]) => (
                      <DropdownMenuItem
                        key={key}
                        onClick={() => handleBulkChangeType(key as ConnectionType)}
                      >
                        {label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Connections</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete {selectedConnections.size} connection{selectedConnections.size !== 1 ? 's' : ''}? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleBulkDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </Card>
        )}

        {/* Connections Table */}
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) (el as any).indeterminate = isPartiallySelected
                    }}
                    onCheckedChange={toggleAll}
                    aria-label="Select all connections"
                  />
                </TableHead>
                <TableHead>
                  <SortButton field="spark1Title">From Spark</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton field="spark2Title">To Spark</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton field="type">Type</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton field="createdAt">Created</SortButton>
                </TableHead>
                <TableHead className="w-12">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedConnections.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {searchQuery || filters.connectionType !== "ALL" || filters.sparkStatus !== "ALL" || filters.dateRange !== "ALL"
                      ? "No connections match your filters"
                      : "No connections found"
                    }
                  </TableCell>
                </TableRow>
              ) : (
                sortedConnections.map((connection) => (
                  <TableRow key={connection.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedConnections.has(connection.id)}
                        onCheckedChange={() => toggleConnection(connection.id)}
                        aria-label={`Select connection ${connection.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: connection.spark1?.color || "#10b981" }}
                        />
                        <span className="font-medium truncate">
                          {connection.spark1?.title || "Unknown Spark"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: connection.spark2?.color || "#10b981" }}
                        />
                        <span className="font-medium truncate">
                          {connection.spark2?.title || "Unknown Spark"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={connectionTypeColors[connection.type]}>
                        {connectionTypeLabels[connection.type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">
                        {new Date(connection.createdAt).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              // TODO: View connection details
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              // TODO: Edit connection
                            }}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              // TODO: Delete single connection
                            }}
                          >
                            <Unlink className="h-4 w-4 mr-2" />
                            Delete Connection
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}