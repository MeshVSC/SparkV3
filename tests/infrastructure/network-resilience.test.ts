// Network resilience tests - offline/online transitions and slow connections
import { testPrisma } from '../setup';

interface NetworkCondition {
  offline: boolean;
  slow: boolean;
  latency?: number;
  bandwidth?: number;
}

class NetworkSimulator {
  private conditions: NetworkCondition = { offline: false, slow: false };
  private requests: Array<{ url: string; method: string; timestamp: number }> = [];

  setConditions(conditions: Partial<NetworkCondition>) {
    this.conditions = { ...this.conditions, ...conditions };
  }

  async simulateRequest(url: string, method: string = 'GET'): Promise<any> {
    this.requests.push({ url, method, timestamp: Date.now() });

    if (this.conditions.offline) {
      throw new Error('Network offline');
    }

    if (this.conditions.slow && this.conditions.latency) {
      await new Promise(resolve => setTimeout(resolve, this.conditions.latency));
    }

    return { status: 200, data: 'simulated response' };
  }

  getRequestLog() {
    return this.requests;
  }

  reset() {
    this.conditions = { offline: false, slow: false };
    this.requests = [];
  }
}

describe('Network Resilience Tests', () => {
  let networkSim: NetworkSimulator;

  beforeEach(() => {
    networkSim = new NetworkSimulator();
  });

  afterEach(() => {
    networkSim.reset();
  });

  describe('Offline/Online State Transitions', () => {
    test('handles offline to online transition', async () => {
      networkSim.setConditions({ offline: true });

      // Attempt request while offline
      await expect(networkSim.simulateRequest('/api/sparks')).rejects.toThrow('Network offline');

      // Go back online
      networkSim.setConditions({ offline: false });

      // Request should succeed
      const result = await networkSim.simulateRequest('/api/sparks');
      expect(result.status).toBe(200);
    });

    test('queues operations during offline state', async () => {
      const operationQueue: Array<() => Promise<any>> = [];

      networkSim.setConditions({ offline: true });

      // Queue operations while offline
      operationQueue.push(() => networkSim.simulateRequest('/api/sparks/create', 'POST'));
      operationQueue.push(() => networkSim.simulateRequest('/api/sparks/update', 'PUT'));

      // Go back online and process queue
      networkSim.setConditions({ offline: false });

      const results = await Promise.all(operationQueue.map(op => op()));
      expect(results).toHaveLength(2);
      expect(results.every(r => r.status === 200)).toBe(true);
    });

    test('detects online/offline state changes', async () => {
      const stateChanges: boolean[] = [];

      // Simulate state monitoring
      const checkConnection = async () => {
        try {
          await networkSim.simulateRequest('/api/health');
          return true;
        } catch {
          return false;
        }
      };

      // Initial online
      stateChanges.push(await checkConnection());

      // Go offline
      networkSim.setConditions({ offline: true });
      stateChanges.push(await checkConnection());

      // Go online
      networkSim.setConditions({ offline: false });
      stateChanges.push(await checkConnection());

      expect(stateChanges).toEqual([true, false, true]);
    });
  });

  describe('Slow Connection Simulation', () => {
    test('handles high latency connections', async () => {
      networkSim.setConditions({ slow: true, latency: 2000 });

      const startTime = Date.now();
      await networkSim.simulateRequest('/api/sparks');
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(1900);
    });

    test('implements request timeout handling', async () => {
      networkSim.setConditions({ slow: true, latency: 5000 });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 3000)
      );

      const requestPromise = networkSim.simulateRequest('/api/sparks');

      await expect(Promise.race([requestPromise, timeoutPromise]))
        .rejects.toThrow('Request timeout');
    });

    test('implements retry logic for slow connections', async () => {
      let attempts = 0;
      const maxRetries = 3;

      const retryRequest = async (): Promise<any> => {
        attempts++;
        if (attempts < maxRetries) {
          networkSim.setConditions({ slow: true, latency: 4000 });
        } else {
          networkSim.setConditions({ slow: false });
        }

        try {
          return await Promise.race([
            networkSim.simulateRequest('/api/sparks'),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 2000)
            )
          ]);
        } catch (error) {
          if (attempts < maxRetries) {
            return retryRequest();
          }
          throw error;
        }
      };

      const result = await retryRequest();
      expect(result.status).toBe(200);
      expect(attempts).toBe(3);
    });
  });

  describe('Connection Recovery', () => {
    test('maintains sync after connection recovery', async () => {
      const localChanges: Array<{ type: string; data: any }> = [];

      // Simulate offline changes
      networkSim.setConditions({ offline: true });
      localChanges.push({ type: 'create', data: { title: 'Offline Spark' } });
      localChanges.push({ type: 'update', data: { id: '1', title: 'Updated Spark' } });

      // Go back online and sync
      networkSim.setConditions({ offline: false });

      const syncPromises = localChanges.map(change => 
        networkSim.simulateRequest(`/api/sparks/${change.type}`, 'POST')
      );

      const results = await Promise.all(syncPromises);
      expect(results).toHaveLength(2);
      expect(results.every(r => r.status === 200)).toBe(true);
    });

    test('handles conflict resolution during sync', async () => {
      const conflicts = [
        { local: { id: '1', title: 'Local Version', updatedAt: new Date('2023-01-01') } },
        { server: { id: '1', title: 'Server Version', updatedAt: new Date('2023-01-02') } }
      ];

      // Server version is newer, should win
      const resolvedConflict = conflicts[0].local.updatedAt > conflicts[1].server.updatedAt 
        ? conflicts[0].local 
        : conflicts[1].server;

      expect(resolvedConflict.title).toBe('Server Version');
    });
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });
});