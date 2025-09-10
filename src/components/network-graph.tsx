'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { Spark, SparkConnection, ConnectionType } from '@/types/spark'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export type LayoutType = 'force' | 'circular' | 'hierarchical'

interface NetworkNode extends d3.SimulationNodeDatum {
  id: string
  title: string
  status: string
  color: string
  level: number
  xp: number
  connections: number
}

interface NetworkLink extends d3.SimulationLinkDatum<NetworkNode> {
  id: string
  type: ConnectionType
  strength: number
}

interface NetworkGraphProps {
  sparks: Spark[]
  connections: SparkConnection[]
  onNodeClick?: (spark: Spark) => void
  className?: string
}

export function NetworkGraphComponent({ 
  sparks, 
  connections, 
  onNodeClick,
  className = '' 
}: NetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<LayoutType>('force')
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  
  // Transform data for D3
  const { nodes, links } = React.useMemo(() => {
    const sparkMap = new Map(sparks.map(spark => [spark.id, spark]))
    
    const nodes: NetworkNode[] = sparks.map(spark => ({
      id: spark.id,
      title: spark.title,
      status: spark.status,
      color: spark.color,
      level: spark.level,
      xp: spark.xp,
      connections: connections.filter(c => c.sparkId1 === spark.id || c.sparkId2 === spark.id).length
    }))
    
    const links: NetworkLink[] = connections
      .filter(conn => sparkMap.has(conn.sparkId1) && sparkMap.has(conn.sparkId2))
      .map(conn => ({
        id: conn.id,
        source: conn.sparkId1,
        target: conn.sparkId2,
        type: conn.type,
        strength: conn.metadata?.strength || 1
      }))
    
    return { nodes, links }
  }, [sparks, connections])

  // Handle container resize
  const handleResize = useCallback(() => {
    if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current
      setDimensions({ 
        width: Math.max(clientWidth, 400), 
        height: Math.max(clientHeight, 300) 
      })
    }
  }, [])

  useEffect(() => {
    handleResize()
    const resizeObserver = new ResizeObserver(handleResize)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }
    return () => resizeObserver.disconnect()
  }, [handleResize])

  // Main D3 visualization effect
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const { width, height } = dimensions
    
    // Create main group with zoom behavior
    const g = svg.append('g')
    
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })
    
    svg.call(zoom)

    // Create node and link selections
    const linkSelection = g.selectAll<SVGLineElement, NetworkLink>('.link')
      .data(links)
      .join('line')
      .attr('class', 'link')
      .attr('stroke', d => getConnectionColor(d.type))
      .attr('stroke-width', d => Math.max(1, d.strength * 2))
      .attr('stroke-opacity', 0.6)

    const nodeSelection = g.selectAll<SVGCircleElement, NetworkNode>('.node')
      .data(nodes)
      .join('circle')
      .attr('class', 'node')
      .attr('r', d => Math.max(8, Math.min(20, 8 + d.level * 2)))
      .attr('fill', d => d.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        const spark = sparks.find(s => s.id === d.id)
        if (spark && onNodeClick) {
          onNodeClick(spark)
        }
      })

    // Add labels
    const labelSelection = g.selectAll<SVGTextElement, NetworkNode>('.label')
      .data(nodes)
      .join('text')
      .attr('class', 'label')
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .attr('font-size', '10px')
      .attr('font-family', 'sans-serif')
      .attr('fill', '#333')
      .attr('pointer-events', 'none')
      .text(d => d.title.length > 15 ? d.title.substring(0, 15) + '...' : d.title)

    // Layout algorithms
    const applyLayout = () => {
      switch (layout) {
        case 'force':
          applyForceLayout()
          break
        case 'circular':
          applyCircularLayout()
          break
        case 'hierarchical':
          applyHierarchicalLayout()
          break
      }
    }

    const applyForceLayout = () => {
      const simulation = d3.forceSimulation<NetworkNode>(nodes)
        .force('link', d3.forceLink<NetworkNode, NetworkLink>(links)
          .id(d => d.id)
          .distance(d => 80 + (1 / d.strength) * 40)
        )
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(d => Math.max(8, 8 + d.level * 2) + 5))

      simulation.on('tick', () => {
        linkSelection
          .attr('x1', d => (d.source as NetworkNode).x!)
          .attr('y1', d => (d.source as NetworkNode).y!)
          .attr('x2', d => (d.target as NetworkNode).x!)
          .attr('y2', d => (d.target as NetworkNode).y!)

        nodeSelection
          .attr('cx', d => d.x!)
          .attr('cy', d => d.y!)

        labelSelection
          .attr('x', d => d.x!)
          .attr('y', d => d.y!)
      })

      // Add drag behavior
      const drag = d3.drag<SVGCircleElement, NetworkNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null
          d.fy = null
        })

      nodeSelection.call(drag)
    }

    const applyCircularLayout = () => {
      const radius = Math.min(width, height) / 2 - 50
      const angleStep = (2 * Math.PI) / nodes.length

      nodes.forEach((d, i) => {
        const angle = i * angleStep
        d.x = width / 2 + radius * Math.cos(angle)
        d.y = height / 2 + radius * Math.sin(angle)
      })

      // Animate to positions
      nodeSelection
        .transition()
        .duration(1000)
        .attr('cx', d => d.x!)
        .attr('cy', d => d.y!)

      labelSelection
        .transition()
        .duration(1000)
        .attr('x', d => d.x!)
        .attr('y', d => d.y!)

      linkSelection
        .transition()
        .duration(1000)
        .attr('x1', d => (d.source as NetworkNode).x!)
        .attr('y1', d => (d.source as NetworkNode).y!)
        .attr('x2', d => (d.target as NetworkNode).x!)
        .attr('y2', d => (d.target as NetworkNode).y!)
    }

    const applyHierarchicalLayout = () => {
      // Create hierarchy based on connections and levels
      const hierarchy = d3.stratify<NetworkNode>()
        .id(d => d.id)
        .parentId(d => {
          // Find parent based on dependencies or highest connected node with higher level
          const dependencies = links.filter(l => 
            (l.target as NetworkNode).id === d.id && l.type === ConnectionType.DEPENDS_ON
          )
          if (dependencies.length > 0) {
            return (dependencies[0].source as NetworkNode).id
          }
          
          const connectedHigherLevel = links
            .filter(l => 
              ((l.source as NetworkNode).id === d.id && (l.target as NetworkNode).level > d.level) ||
              ((l.target as NetworkNode).id === d.id && (l.source as NetworkNode).level > d.level)
            )
            .map(l => {
              const otherId = (l.source as NetworkNode).id === d.id ? 
                (l.target as NetworkNode).id : (l.source as NetworkNode).id
              return nodes.find(n => n.id === otherId)!
            })
            .sort((a, b) => b.level - a.level)[0]

          return connectedHigherLevel?.id || null
        })

      try {
        const root = hierarchy(nodes)
        const treeLayout = d3.tree<NetworkNode>()
          .size([width - 100, height - 100])

        treeLayout(root)

        // Apply positions from tree layout
        root.descendants().forEach(d => {
          if (d.data) {
            d.data.x = d.x! + 50
            d.data.y = d.y! + 50
          }
        })

      } catch (error) {
        // Fallback to level-based layout if hierarchy fails
        const levels = Array.from(new Set(nodes.map(n => n.level))).sort((a, b) => a - b)
        const levelHeight = height / (levels.length + 1)
        
        levels.forEach((level, levelIndex) => {
          const nodesAtLevel = nodes.filter(n => n.level === level)
          const levelWidth = width / (nodesAtLevel.length + 1)
          
          nodesAtLevel.forEach((node, nodeIndex) => {
            node.x = (nodeIndex + 1) * levelWidth
            node.y = (levelIndex + 1) * levelHeight
          })
        })
      }

      // Animate to positions
      nodeSelection
        .transition()
        .duration(1000)
        .attr('cx', d => d.x!)
        .attr('cy', d => d.y!)

      labelSelection
        .transition()
        .duration(1000)
        .attr('x', d => d.x!)
        .attr('y', d => d.y!)

      linkSelection
        .transition()
        .duration(1000)
        .attr('x1', d => (d.source as NetworkNode).x!)
        .attr('y1', d => (d.source as NetworkNode).y!)
        .attr('x2', d => (d.target as NetworkNode).x!)
        .attr('y2', d => (d.target as NetworkNode).y!)
    }

    applyLayout()

    // Cleanup function
    return () => {
      svg.selectAll('*').remove()
    }
  }, [nodes, links, layout, dimensions, sparks, onNodeClick])

  const getConnectionColor = (type: ConnectionType): string => {
    switch (type) {
      case ConnectionType.DEPENDS_ON:
        return '#dc2626' // red
      case ConnectionType.RELATED_TO:
        return '#2563eb' // blue
      case ConnectionType.INSPIRES:
        return '#16a34a' // green
      case ConnectionType.CONFLICTS_WITH:
        return '#ea580c' // orange
      default:
        return '#6b7280' // gray
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Network Graph</CardTitle>
          <Select value={layout} onValueChange={(value: LayoutType) => setLayout(value)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Layout" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="force">Force-Directed</SelectItem>
              <SelectItem value="circular">Circular</SelectItem>
              <SelectItem value="hierarchical">Hierarchical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div 
          ref={containerRef} 
          className="w-full h-[600px] relative overflow-hidden"
        >
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height}
            className="w-full h-full"
          />
          
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-lg font-medium mb-2">No sparks to display</p>
                <p className="text-sm">Create some sparks and connections to see the network visualization</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Legend */}
        <div className="p-4 border-t bg-muted/30">
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-red-600"></div>
              <span>Depends On</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-blue-600"></div>
              <span>Related To</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-green-600"></div>
              <span>Inspires</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-orange-600"></div>
              <span>Conflicts With</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}