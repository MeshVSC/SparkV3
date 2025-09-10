'use client'

import React from 'react'
import { NetworkGraphComponent } from './network-graph'
import { Spark, SparkConnection, SparkStatus, ConnectionType } from '@/types/spark'

// Example usage component
export function NetworkGraphExample() {
  // Sample data for demonstration
  const sampleSparks: Spark[] = [
    {
      id: '1',
      userId: 'user1',
      title: 'Learn D3.js',
      description: 'Master data visualization with D3',
      status: SparkStatus.SAPLING,
      xp: 150,
      level: 2,
      color: '#3b82f6',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '2',
      userId: 'user1',
      title: 'React Hooks',
      description: 'Deep dive into React hooks',
      status: SparkStatus.TREE,
      xp: 300,
      level: 3,
      color: '#10b981',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '3',
      userId: 'user1',
      title: 'TypeScript',
      description: 'Learn TypeScript fundamentals',
      status: SparkStatus.SEEDLING,
      xp: 75,
      level: 1,
      color: '#f59e0b',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '4',
      userId: 'user1',
      title: 'Network Visualization',
      description: 'Create interactive network graphs',
      status: SparkStatus.SAPLING,
      xp: 200,
      level: 2,
      color: '#8b5cf6',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]

  const sampleConnections: SparkConnection[] = [
    {
      id: 'conn1',
      sparkId1: '2',
      sparkId2: '1',
      type: ConnectionType.DEPENDS_ON,
      metadata: { strength: 0.8 },
      createdAt: new Date()
    },
    {
      id: 'conn2',
      sparkId1: '1',
      sparkId2: '4',
      type: ConnectionType.INSPIRES,
      metadata: { strength: 0.9 },
      createdAt: new Date()
    },
    {
      id: 'conn3',
      sparkId1: '3',
      sparkId2: '2',
      type: ConnectionType.RELATED_TO,
      metadata: { strength: 0.6 },
      createdAt: new Date()
    }
  ]

  const handleNodeClick = (spark: Spark) => {
    console.log('Clicked spark:', spark.title)
    // Handle node click - could open a detail modal, navigate, etc.
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Network Graph Component Demo</h1>
      <NetworkGraphComponent
        sparks={sampleSparks}
        connections={sampleConnections}
        onNodeClick={handleNodeClick}
        className="w-full"
      />
    </div>
  )
}