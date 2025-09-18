// Load testing for concurrent user sessions
import { testPrisma } from '../setup';

interface LoadTestMetrics {
  totalRequests: number;
  successfulRequests: number;
  averageResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  errorRate: number;
}

class LoadTester {
  private metrics: LoadTestMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    averageResponseTime: 0,
    maxResponseTime: 0,
    minResponseTime: Infinity,
    errorRate: 0
  };

  async simulateUserSession(userId: string, duration: number = 5000): Promise<void> {
    const startTime = Date.now();
    const operations = ['read', 'create', 'update', 'delete'];
    
    while (Date.now() - startTime < duration) {
      const operation = operations[Math.floor(Math.random() * operations.length)];
      const requestStart = Date.now();
      
      try {
        await this.performOperation(operation, userId);
        const responseTime = Date.now() - requestStart;
        this.updateMetrics(responseTime, true);
      } catch (error) {
        const responseTime = Date.now() - requestStart;
        this.updateMetrics(responseTime, false);
      }

      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
    }
  }

  private async performOperation(operation: string, userId: string): Promise<any> {
    switch (operation) {
      case 'read':
        return testPrisma.user.findUnique({ where: { id: userId } });
      case 'create':
        return testPrisma.spark.create({
          data: { userId, title: `Load Test Spark ${Date.now()}` }
        });
      case 'update':
        return testPrisma.user.update({
          where: { id: userId },
          data: { totalXP: { increment: 1 } }
        });
      case 'delete':
        const spark = await testPrisma.spark.findFirst({ where: { userId } });
        if (spark) {
          return testPrisma.spark.delete({ where: { id: spark.id } });
        }
        break;
    }
  }

  private updateMetrics(responseTime: number, success: boolean): void {
    this.metrics.totalRequests++;
    if (success) this.metrics.successfulRequests++;
    
    this.metrics.maxResponseTime = Math.max(this.metrics.maxResponseTime, responseTime);
    this.metrics.minResponseTime = Math.min(this.metrics.minResponseTime, responseTime);
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) / 
      this.metrics.totalRequests;
    this.metrics.errorRate = 
      (this.metrics.totalRequests - this.metrics.successfulRequests) / 
      this.metrics.totalRequests * 100;
  }

  getMetrics(): LoadTestMetrics {
    return { ...this.metrics };
  }
}

describe('Load Testing', () => {
  let loadTester: LoadTester;
  let testUsers: string[] = [];

  beforeAll(async () => {
    // Create test users
    for (let i = 0; i < 5; i++) {
      const user = await testPrisma.user.create({
        data: {
          email: `loadtest${i}@test.com`,
          name: `Load Test User ${i}`
        }
      });
      testUsers.push(user.id);
    }
  });

  beforeEach(() => {
    loadTester = new LoadTester();
  });

  describe('Concurrent User Sessions', () => {
    test('handles multiple concurrent users', async () => {
      const sessionPromises = testUsers.map(userId => 
        loadTester.simulateUserSession(userId, 3000)
      );

      await Promise.all(sessionPromises);

      const metrics = loadTester.getMetrics();
      expect(metrics.totalRequests).toBeGreaterThan(0);
      expect(metrics.errorRate).toBeLessThan(10); // Less than 10% error rate
    });

    test('measures response times under stress', async () => {
      const concurrentUsers = 10;
      const sessions = Array(concurrentUsers).fill(null).map((_, i) => 
        loadTester.simulateUserSession(testUsers[i % testUsers.length], 2000)
      );

      const startTime = Date.now();
      await Promise.all(sessions);
      const totalTime = Date.now() - startTime;

      const metrics = loadTester.getMetrics();
      expect(metrics.averageResponseTime).toBeLessThan(5000);
      expect(totalTime).toBeLessThan(10000);
    });
  });

  describe('Performance Benchmarks', () => {
    test('maintains performance under load', async () => {
      const iterations = 50;
      const responseTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await testPrisma.user.count();
        responseTimes.push(Date.now() - start);
      }

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / iterations;
      const maxResponseTime = Math.max(...responseTimes);

      expect(avgResponseTime).toBeLessThan(100);
      expect(maxResponseTime).toBeLessThan(500);
    });
  });

  afterAll(async () => {
    // Clean up test users and their data
    await testPrisma.spark.deleteMany({
      where: { userId: { in: testUsers } }
    });
    await testPrisma.user.deleteMany({
      where: { id: { in: testUsers } }
    });
    await testPrisma.$disconnect();
  });
});