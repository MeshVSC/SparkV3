'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { Spark, SparkConnection, ConnectionType } from '@/types/spark'

interface NetworkMetrics {
  totalNodes: number
  totalEdges: number
  networkDensity: number
  averagePathLength: number
  clusteringCoefficient: number
  networkDiameter: number
  connectedComponents: number
}

interface NodeMetrics {
  id: string
  title: string
  degree: number
  betweennessCentrality: number
  closenessCentrality: number
  eigenvectorCentrality: number
  clusteringCoefficient: number
  color: string
  level: number
  xp: number
}

interface ConnectionCluster {
  id: string
  nodes: string[]
  size: number
  density: number
  avgPathLength: number
}

interface ConnectionAnalyticsDashboardProps {
  sparks: Spark[]
  connections: SparkConnection[]
  className?: string
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0']

export function ConnectionAnalyticsDashboard({
  sparks,
  connections,
  className = ''
}: ConnectionAnalyticsDashboardProps) {
  
  // Core network metrics calculations
  const networkAnalytics = useMemo(() => {
    if (!sparks.length || !connections.length) {
      return {
        networkMetrics: {
          totalNodes: sparks.length,
          totalEdges: 0,
          networkDensity: 0,
          averagePathLength: 0,
          clusteringCoefficient: 0,
          networkDiameter: 0,
          connectedComponents: sparks.length
        } as NetworkMetrics,
        nodeMetrics: [] as NodeMetrics[],
        clusters: [] as ConnectionCluster[],
        connectionTypeDistribution: [] as any[],
        temporalAnalysis: [] as any[],
        strengthDistribution: [] as any[]
      }
    }

    // Build adjacency matrix and graph representation
    const nodeMap = new Map<string, number>()
    sparks.forEach((spark, index) => nodeMap.set(spark.id, index))
    const n = sparks.length
    const adjacencyMatrix = Array(n).fill(null).map(() => Array(n).fill(0))
    const adjacencyList = Array(n).fill(null).map(() => [] as number[])

    connections.forEach(conn => {
      const i = nodeMap.get(conn.sparkId1)
      const j = nodeMap.get(conn.sparkId2)
      if (i !== undefined && j !== undefined) {
        adjacencyMatrix[i][j] = 1
        adjacencyMatrix[j][i] = 1
        adjacencyList[i].push(j)
        adjacencyList[j].push(i)
      }
    })

    // Calculate network metrics
    const totalEdges = connections.length
    const maxPossibleEdges = n * (n - 1) / 2
    const networkDensity = maxPossibleEdges > 0 ? totalEdges / maxPossibleEdges : 0

    // Floyd-Warshall for shortest paths
    const distances = Array(n).fill(null).map(() => Array(n).fill(Infinity))
    for (let i = 0; i < n; i++) distances[i][i] = 0
    
    connections.forEach(conn => {
      const i = nodeMap.get(conn.sparkId1)
      const j = nodeMap.get(conn.sparkId2)
      if (i !== undefined && j !== undefined) {
        distances[i][j] = 1
        distances[j][i] = 1
      }
    })

    for (let k = 0; k < n; k++) {
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (distances[i][k] + distances[k][j] < distances[i][j]) {
            distances[i][j] = distances[i][k] + distances[k][j]
          }
        }
      }
    }

    // Average path length and diameter
    let totalPathLength = 0
    let pathCount = 0
    let diameter = 0
    
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (distances[i][j] !== Infinity) {
          totalPathLength += distances[i][j]
          pathCount++
          diameter = Math.max(diameter, distances[i][j])
        }
      }
    }

    const averagePathLength = pathCount > 0 ? totalPathLength / pathCount : 0

    // Connected components using DFS
    const visited = new Array(n).fill(false)
    let components = 0
    
    const dfs = (node: number) => {
      visited[node] = true
      adjacencyList[node].forEach(neighbor => {
        if (!visited[neighbor]) dfs(neighbor)
      })
    }

    for (let i = 0; i < n; i++) {
      if (!visited[i]) {
        dfs(i)
        components++
      }
    }

    // Calculate node-level metrics
    const nodeMetrics: NodeMetrics[] = sparks.map((spark, index) => {
      const degree = adjacencyList[index].length

      // Betweenness centrality
      let betweenness = 0
      for (let s = 0; s < n; s++) {
        if (s === index) continue
        for (let t = s + 1; t < n; t++) {
          if (t === index || s === t) continue
          if (distances[s][t] !== Infinity && distances[s][t] > 0) {
            if (distances[s][index] + distances[index][t] === distances[s][t]) {
              betweenness += 1 / distances[s][t]
            }
          }
        }
      }

      // Closeness centrality
      const closenessSum = distances[index].reduce((sum, d) => 
        d !== Infinity ? sum + d : sum, 0
      )
      const reachableNodes = distances[index].filter(d => d !== Infinity).length - 1
      const closeness = reachableNodes > 0 ? reachableNodes / closenessSum : 0

      // Local clustering coefficient
      let triangles = 0
      const neighbors = adjacencyList[index]
      for (let i = 0; i < neighbors.length; i++) {
        for (let j = i + 1; j < neighbors.length; j++) {
          if (adjacencyMatrix[neighbors[i]][neighbors[j]] === 1) {
            triangles++
          }
        }
      }
      const possibleTriangles = neighbors.length * (neighbors.length - 1) / 2
      const localClustering = possibleTriangles > 0 ? triangles / possibleTriangles : 0

      return {
        id: spark.id,
        title: spark.title,
        degree,
        betweennessCentrality: betweenness,
        closenessCentrality: closeness,
        eigenvectorCentrality: degree / Math.max(1, n - 1), // Simplified approximation
        clusteringCoefficient: localClustering,
        color: spark.color,
        level: spark.level,
        xp: spark.xp
      }
    })

    // Global clustering coefficient
    const globalClustering = nodeMetrics.reduce((sum, node) => 
      sum + node.clusteringCoefficient, 0
    ) / n

    // Identify clusters using simple community detection
    const clusters: ConnectionCluster[] = []
    const clustered = new Set<string>()

    sparks.forEach(spark => {
      if (clustered.has(spark.id)) return

      const cluster: string[] = [spark.id]
      const queue = [spark.id]
      clustered.add(spark.id)

      while (queue.length > 0) {
        const currentId = queue.shift()!
        const nodeConnections = connections.filter(c => 
          c.sparkId1 === currentId || c.sparkId2 === currentId
        )

        nodeConnections.forEach(conn => {
          const otherId = conn.sparkId1 === currentId ? conn.sparkId2 : conn.sparkId1
          if (!clustered.has(otherId) && sparks.find(s => s.id === otherId)) {
            clustered.add(otherId)
            cluster.push(otherId)
            queue.push(otherId)
          }
        })
      }

      if (cluster.length > 1) {
        const clusterConnections = connections.filter(c =>
          cluster.includes(c.sparkId1) && cluster.includes(c.sparkId2)
        ).length
        const maxClusterConnections = cluster.length * (cluster.length - 1) / 2
        const clusterDensity = maxClusterConnections > 0 ? 
          clusterConnections / maxClusterConnections : 0

        clusters.push({
          id: `cluster-${clusters.length}`,
          nodes: cluster,
          size: cluster.length,
          density: clusterDensity,
          avgPathLength: 0 // Simplified
        })
      }
    })

    // Connection type distribution
    const typeCount = Object.values(ConnectionType).map(type => ({
      type,
      count: connections.filter(c => c.type === type).length,
      percentage: connections.length > 0 ? 
        (connections.filter(c => c.type === type).length / connections.length) * 100 : 0
    }))

    // Temporal analysis (connections over time)
    const connectionsByMonth = connections.reduce((acc, conn) => {
      const month = conn.createdAt.toISOString().substring(0, 7)
      acc[month] = (acc[month] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const temporalAnalysis = Object.entries(connectionsByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, connections: count }))

    // Connection strength distribution
    const strengthDistribution = connections
      .map(c => c.metadata?.strength || 1)
      .reduce((acc, strength) => {
        const bucket = Math.floor(strength * 5) / 5 // Round to nearest 0.2
        const key = bucket.toString()
        acc[key] = (acc[key] || 0) + 1
        return acc
      }, {} as Record<string, number>)

    const strengthData = Object.entries(strengthDistribution)
      .map(([strength, count]) => ({ strength: parseFloat(strength), count }))
      .sort((a, b) => a.strength - b.strength)

    return {
      networkMetrics: {
        totalNodes: n,
        totalEdges,
        networkDensity,
        averagePathLength,
        clusteringCoefficient: globalClustering,
        networkDiameter: diameter,
        connectedComponents: components
      },
      nodeMetrics,
      clusters,
      connectionTypeDistribution: typeCount,
      temporalAnalysis,
      strengthDistribution: strengthData
    }
  }, [sparks, connections])

  const {
    networkMetrics,
    nodeMetrics,
    clusters,
    connectionTypeDistribution,
    temporalAnalysis,
    strengthDistribution
  } = networkAnalytics

  // Top connected sparks for charts
  const topConnectedSparks = nodeMetrics
    .sort((a, b) => b.degree - a.degree)
    .slice(0, 10)

  const centralityData = nodeMetrics
    .sort((a, b) => b.betweennessCentrality - a.betweennessCentrality)
    .slice(0, 15)
    .map(node => ({
      name: node.title.length > 15 ? node.title.substring(0, 15) + '...' : node.title,
      betweenness: Math.round(node.betweennessCentrality * 100) / 100,
      closeness: Math.round(node.closenessCentrality * 100) / 100,
      degree: node.degree
    }))

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Network</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{networkMetrics.totalNodes}</div>
            <p className="text-xs text-muted-foreground">
              sparks, {networkMetrics.totalEdges} connections
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Network Density</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(networkMetrics.networkDensity * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              connection saturation
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Path Length</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {networkMetrics.averagePathLength.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              steps between sparks
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Clustering</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(networkMetrics.clusteringCoefficient * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              local connectivity
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="connections" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="centrality">Centrality</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
          <TabsTrigger value="temporal">Growth</TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Most Connected Sparks</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topConnectedSparks}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="title" 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      fontSize={12}
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="degree" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Connection Types</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={connectionTypeDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ type, percentage }) => 
                        `${type.replace('_', ' ')} (${percentage.toFixed(1)}%)`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {connectionTypeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="centrality" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Centrality Measures</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart data={centralityData}>
                  <CartesianGrid />
                  <XAxis 
                    type="number" 
                    dataKey="betweenness" 
                    name="betweenness"
                    label={{ value: 'Betweenness Centrality', position: 'bottom' }}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="closeness" 
                    name="closeness"
                    label={{ value: 'Closeness Centrality', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    formatter={(value, name) => [value, name === 'betweenness' ? 'Betweenness' : 'Closeness']}
                    labelFormatter={(value) => `Spark: ${value}`}
                  />
                  <Scatter name="Sparks" dataKey="closeness" fill="#8884d8" />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Connection Clusters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {clusters.slice(0, 5).map((cluster, index) => (
                    <div key={cluster.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">Cluster {index + 1}</div>
                        <div className="text-sm text-muted-foreground">
                          {cluster.size} sparks, {(cluster.density * 100).toFixed(1)}% density
                        </div>
                      </div>
                      <Badge variant="secondary">{cluster.size}</Badge>
                    </div>
                  ))}
                  {clusters.length === 0 && (
                    <p className="text-muted-foreground text-center py-8">
                      No significant clusters detected
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Connection Strength</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={strengthDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="strength" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="temporal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Network Growth Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={temporalAnalysis}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="connections" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                    dot={{ fill: '#8884d8' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}