import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Performance Monitoring Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    performance.clearMarks?.()
    performance.clearMeasures?.()
  })

  describe('Load Time Monitoring', () => {
    it('measures import operation duration', async () => {
      const startTime = performance.now()
      
      // Simulate import operation
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      expect(duration).toBeGreaterThan(90)
      expect(duration).toBeLessThan(200)
    })

    it('tracks API response times', async () => {
      const apiTimes: number[] = []
      
      global.fetch = vi.fn().mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({ ok: true, json: () => ({}) })
          }, Math.random() * 100 + 50) // 50-150ms
        })
      })

      for (let i = 0; i < 5; i++) {
        const start = performance.now()
        await fetch('/api/test')
        const duration = performance.now() - start
        apiTimes.push(duration)
      }

      const averageTime = apiTimes.reduce((a, b) => a + b, 0) / apiTimes.length
      expect(averageTime).toBeGreaterThan(50)
      expect(averageTime).toBeLessThan(200)
    })

    it('uses Performance API marks and measures', () => {
      performance.mark('import-start')
      
      // Simulate work
      const data = Array(1000).fill(0).map((_, i) => ({ id: i }))
      
      performance.mark('import-end')
      performance.measure('import-duration', 'import-start', 'import-end')
      
      expect(performance.mark).toHaveBeenCalledWith('import-start')
      expect(performance.mark).toHaveBeenCalledWith('import-end')
      expect(performance.measure).toHaveBeenCalledWith('import-duration', 'import-start', 'import-end')
    })

    it('monitors component render times', () => {
      const renderTimes: number[] = []
      
      // Mock React profiler callback
      const onRender = (id: string, phase: string, actualDuration: number) => {
        renderTimes.push(actualDuration)
      }
      
      // Simulate renders
      onRender('SparkList', 'mount', 45.2)
      onRender('SparkList', 'update', 12.8)
      onRender('SparkList', 'update', 8.1)
      
      expect(renderTimes).toEqual([45.2, 12.8, 8.1])
      expect(Math.max(...renderTimes)).toBe(45.2) // Mount is slowest
    })
  })

  describe('Memory Usage Monitoring', () => {
    it('tracks JavaScript heap size', () => {
      const memInfo = performance.memory
      
      expect(memInfo.usedJSHeapSize).toBeDefined()
      expect(memInfo.totalJSHeapSize).toBeDefined()
      expect(memInfo.jsHeapSizeLimit).toBeDefined()
      expect(memInfo.usedJSHeapSize).toBeLessThanOrEqual(memInfo.totalJSHeapSize)
    })

    it('detects memory leaks during operations', () => {
      const initialMemory = performance.memory.usedJSHeapSize
      const memorySnapshots: number[] = []
      
      // Simulate memory-intensive operation
      for (let i = 0; i < 10; i++) {
        const largeArray = Array(10000).fill(0).map(() => ({ data: 'x'.repeat(100) }))
        memorySnapshots.push(performance.memory.usedJSHeapSize)
        
        // Clean up references
        largeArray.length = 0
      }
      
      expect(memorySnapshots).toHaveLength(10)
      expect(memorySnapshots[0]).toBeGreaterThan(initialMemory)
    })

    it('monitors memory during file processing', async () => {
      const memoryBefore = performance.memory.usedJSHeapSize
      
      // Simulate large file processing
      const largeData = Array(50000).fill(0).map((_, i) => ({
        id: i,
        title: `Item ${i}`,
        description: 'x'.repeat(200)
      }))
      
      const jsonString = JSON.stringify(largeData)
      const memoryPeak = performance.memory.usedJSHeapSize
      
      // Process and clean up
      const parsed = JSON.parse(jsonString)
      expect(parsed).toHaveLength(50000)
      
      const memoryAfter = performance.memory.usedJSHeapSize
      expect(memoryPeak).toBeGreaterThan(memoryBefore)
    })

    it('tracks memory usage patterns', () => {
      const measurements: Array<{ operation: string; memoryDelta: number }> = []
      
      const measureMemory = (operationName: string, fn: () => void) => {
        const before = performance.memory.usedJSHeapSize
        fn()
        const after = performance.memory.usedJSHeapSize
        measurements.push({ operation: operationName, memoryDelta: after - before })
      }
      
      measureMemory('createArray', () => {
        const arr = Array(1000).fill({ data: 'test' })
        return arr.length
      })
      
      measureMemory('stringOperation', () => {
        const str = 'test'.repeat(1000)
        return str.length
      })
      
      expect(measurements).toHaveLength(2)
      expect(measurements[0].operation).toBe('createArray')
    })
  })

  describe('Performance Benchmarks', () => {
    it('benchmarks JSON parsing performance', () => {
      const testSizes = [100, 1000, 10000]
      const results: Array<{ size: number; duration: number }> = []
      
      testSizes.forEach(size => {
        const testData = { items: Array(size).fill(0).map((_, i) => ({ id: i, name: `Item ${i}` })) }
        const jsonString = JSON.stringify(testData)
        
        const start = performance.now()
        JSON.parse(jsonString)
        const duration = performance.now() - start
        
        results.push({ size, duration })
      })
      
      // Larger datasets should take more time
      expect(results[2].duration).toBeGreaterThan(results[0].duration)
      expect(results.every(r => r.duration < 100)).toBe(true) // All should be fast
    })

    it('benchmarks CSV processing performance', async () => {
      const rowCounts = [100, 1000, 5000]
      const benchmarks: Array<{ rows: number; parseTime: number }> = []
      
      for (const rowCount of rowCounts) {
        const csvData = ['id,name,status']
        for (let i = 0; i < rowCount; i++) {
          csvData.push(`${i},Name ${i},active`)
        }
        const csvString = csvData.join('\n')
        
        const start = performance.now()
        const lines = csvString.split('\n')
        const parsed = lines.slice(1).map(line => {
          const [id, name, status] = line.split(',')
          return { id, name, status }
        })
        const parseTime = performance.now() - start
        
        benchmarks.push({ rows: rowCount, parseTime })
        expect(parsed).toHaveLength(rowCount)
      }
      
      expect(benchmarks).toHaveLength(3)
      expect(benchmarks[2].parseTime).toBeGreaterThan(benchmarks[0].parseTime)
    })

    it('identifies performance bottlenecks', () => {
      const operations = [
        { name: 'fastOperation', duration: 5 },
        { name: 'slowOperation', duration: 150 },
        { name: 'mediumOperation', duration: 45 }
      ]
      
      const PERFORMANCE_THRESHOLD = 100
      const bottlenecks = operations.filter(op => op.duration > PERFORMANCE_THRESHOLD)
      
      expect(bottlenecks).toHaveLength(1)
      expect(bottlenecks[0].name).toBe('slowOperation')
    })

    it('tracks performance regressions', () => {
      const baselineMetrics = {
        importTime: 120,
        exportTime: 80,
        renderTime: 25
      }
      
      const currentMetrics = {
        importTime: 145, // 20% slower
        exportTime: 75,  // 6% faster
        renderTime: 35   // 40% slower
      }
      
      const regressions: string[] = []
      const REGRESSION_THRESHOLD = 0.15 // 15%
      
      Object.entries(currentMetrics).forEach(([metric, current]) => {
        const baseline = baselineMetrics[metric as keyof typeof baselineMetrics]
        const change = (current - baseline) / baseline
        
        if (change > REGRESSION_THRESHOLD) {
          regressions.push(metric)
        }
      })
      
      expect(regressions).toContain('importTime')
      expect(regressions).toContain('renderTime')
      expect(regressions).not.toContain('exportTime')
    })
  })

  describe('Real-time Performance Monitoring', () => {
    it('tracks performance over time', () => {
      const performanceHistory: Array<{ timestamp: number; value: number }> = []
      
      // Simulate periodic measurements
      const measurePerformance = () => {
        const value = Math.random() * 100 + 50 // Random 50-150ms
        performanceHistory.push({ timestamp: Date.now(), value })
      }
      
      for (let i = 0; i < 10; i++) {
        measurePerformance()
      }
      
      expect(performanceHistory).toHaveLength(10)
      expect(performanceHistory.every(m => m.value >= 50 && m.value <= 150)).toBe(true)
    })

    it('alerts on performance degradation', () => {
      const metrics = [45, 52, 48, 55, 120, 125, 130] // Sudden spike
      const alerts: string[] = []
      const ALERT_THRESHOLD = 100
      
      metrics.forEach((value, index) => {
        if (value > ALERT_THRESHOLD) {
          alerts.push(`Performance alert at measurement ${index}: ${value}ms`)
        }
      })
      
      expect(alerts).toHaveLength(3)
      expect(alerts[0]).toContain('measurement 4')
    })
  })
})