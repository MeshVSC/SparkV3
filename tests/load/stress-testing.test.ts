// Stress testing scenarios
import { testPrisma } from '../setup';

interface StressTestConfig {
  concurrent: number;
  duration: number;
  operations: string[];
  expectedErrorRate: number;
}

class StressTester {
  private results: Array<{
    operation: string;
    success: boolean;
    responseTime: number;
    timestamp: number;
  }> = [];

  async runStressTest(config: StressTestConfig): Promise<void> {
    const workers = Array(config.concurrent).fill(null).map(() => 
      this.runWorker(config)
    );

    await Promise.all(workers);
  }

  private async runWorker(config: StressTestConfig): Promise<void> {
    const endTime = Date.now() + config.duration;

    while (Date.now() < endTime) {
      const operation = config.operations[
        Math.floor(Math.random() * config.operations.length)
      ];

      const start = Date.now();
      let success = false;

      try {
        await this.executeOperation(operation);
        success = true;
      } catch (error) {
        // Record failure
      }

      this.results.push({
        operation,
        success,
        responseTime: Date.now() - start,
        timestamp: Date.now()
      });

      // Brief pause between operations
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  private async executeOperation(operation: string): Promise<any> {
    switch (operation) {
      case 'read':
        return testPrisma.user.findMany({ take: 10 });
      case 'write':
        return testPrisma.user.create({
          data: {
            email: `stress${Date.now()}@test.com`,
            name: 'Stress Test User'
          }
        });
      case 'update':
        const users = await testPrisma.user.findMany({ take: 1 });
        if (users.length > 0) {
          return testPrisma.user.update({
            where: { id: users[0].id },
            data: { totalXP: { increment: 1 } }
          });
        }
        break;
      case 'delete':
        const user = await testPrisma.user.findFirst({
          where: { email: { startsWith: 'stress' } }
        });
        if (user) {
          return testPrisma.user.delete({ where: { id: user.id } });
        }
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  getMetrics() {
    const successful = this.results.filter(r => r.success).length;
    const total = this.results.length;
    const errorRate = ((total - successful) / total) * 100;
    
    const responseTimes = this.results.map(r => r.responseTime);
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const maxResponseTime = Math.max(...responseTimes);
    const minResponseTime = Math.min(...responseTimes);

    const throughput = total / (Math.max(...this.results.map(r => r.timestamp)) - 
                                Math.min(...this.results.map(r => r.timestamp))) * 1000;

    return {
      totalOperations: total,
      successfulOperations: successful,
      errorRate,
      avgResponseTime,
      maxResponseTime,
      minResponseTime,
      throughput
    };
  }

  reset() {
    this.results = [];
  }
}

describe('Stress Testing', () => {
  let stressTester: StressTester;

  beforeEach(() => {
    stressTester = new StressTester();
  });

  afterEach(() => {
    stressTester.reset();
  });

  describe('Database Stress Tests', () => {
    test('handles high read load', async () => {
      const config: StressTestConfig = {
        concurrent: 10,
        duration: 5000,
        operations: ['read'],
        expectedErrorRate: 5
      };

      await stressTester.runStressTest(config);
      const metrics = stressTester.getMetrics();

      expect(metrics.errorRate).toBeLessThan(config.expectedErrorRate);
      expect(metrics.avgResponseTime).toBeLessThan(1000);
      expect(metrics.totalOperations).toBeGreaterThan(10);
    });

    test('handles mixed workload stress', async () => {
      const config: StressTestConfig = {
        concurrent: 8,
        duration: 4000,
        operations: ['read', 'write', 'update'],
        expectedErrorRate: 10
      };

      await stressTester.runStressTest(config);
      const metrics = stressTester.getMetrics();

      expect(metrics.errorRate).toBeLessThan(config.expectedErrorRate);
      expect(metrics.throughput).toBeGreaterThan(1); // At least 1 op/second
    });

    test('recovers from stress conditions', async () => {
      // First, apply stress
      await stressTester.runStressTest({
        concurrent: 15,
        duration: 3000,
        operations: ['read', 'write', 'update', 'delete'],
        expectedErrorRate: 15
      });

      const stressMetrics = stressTester.getMetrics();
      stressTester.reset();

      // Then test normal conditions
      await stressTester.runStressTest({
        concurrent: 3,
        duration: 2000,
        operations: ['read'],
        expectedErrorRate: 2
      });

      const normalMetrics = stressTester.getMetrics();

      // Normal conditions should perform better
      expect(normalMetrics.errorRate).toBeLessThan(stressMetrics.errorRate);
      expect(normalMetrics.avgResponseTime).toBeLessThan(stressMetrics.avgResponseTime);
    });
  });

  describe('Memory and Resource Usage', () => {
    test('maintains reasonable memory usage under load', async () => {
      const initialMemory = process.memoryUsage();

      await stressTester.runStressTest({
        concurrent: 12,
        duration: 5000,
        operations: ['read', 'write'],
        expectedErrorRate: 8
      });

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    test('handles resource exhaustion gracefully', async () => {
      // Create many objects to consume memory
      const largeObjects: any[] = [];
      
      try {
        for (let i = 0; i < 1000; i++) {
          largeObjects.push(new Array(1000).fill(`data-${i}`));
        }

        await stressTester.runStressTest({
          concurrent: 5,
          duration: 2000,
          operations: ['read'],
          expectedErrorRate: 20
        });

        const metrics = stressTester.getMetrics();
        expect(metrics.totalOperations).toBeGreaterThan(0);

      } finally {
        // Clean up
        largeObjects.length = 0;
      }
    });
  });

  afterAll(async () => {
    // Clean up stress test data
    await testPrisma.user.deleteMany({
      where: { email: { startsWith: 'stress' } }
    });
    await testPrisma.$disconnect();
  });
});