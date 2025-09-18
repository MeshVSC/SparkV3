// Third-party service integration tests
interface APIRateLimiter {
  requests: number;
  windowStart: number;
  limit: number;
  windowMs: number;
}

class MockServiceIntegration {
  private rateLimiter: APIRateLimiter = {
    requests: 0,
    windowStart: Date.now(),
    limit: 10,
    windowMs: 60000
  };
  private failures: number = 0;
  private responseDelay: number = 0;

  setFailureRate(rate: number) {
    this.failures = rate;
  }

  setResponseDelay(ms: number) {
    this.responseDelay = ms;
  }

  async makeRequest(endpoint: string): Promise<any> {
    // Check rate limit
    const now = Date.now();
    if (now - this.rateLimiter.windowStart > this.rateLimiter.windowMs) {
      this.rateLimiter.requests = 0;
      this.rateLimiter.windowStart = now;
    }

    if (this.rateLimiter.requests >= this.rateLimiter.limit) {
      throw new Error('Rate limit exceeded');
    }

    this.rateLimiter.requests++;

    // Simulate delay
    if (this.responseDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.responseDelay));
    }

    // Simulate random failures
    if (Math.random() * 100 < this.failures) {
      throw new Error('Service temporarily unavailable');
    }

    return { status: 200, data: `Response from ${endpoint}` };
  }

  async makeRequestWithRetry(endpoint: string, maxRetries = 3): Promise<any> {
    let lastError: Error;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await this.makeRequest(endpoint);
      } catch (error) {
        lastError = error as Error;
        
        if (i < maxRetries) {
          const delay = Math.pow(2, i) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError!;
  }

  async makeRequestWithFallback(endpoint: string, fallbackData: any): Promise<any> {
    try {
      return await this.makeRequest(endpoint);
    } catch (error) {
      console.warn(`Service failed, using fallback: ${error.message}`);
      return { status: 200, data: fallbackData, fromFallback: true };
    }
  }
}

describe('Third-Party Service Integration Tests', () => {
  let service: MockServiceIntegration;

  beforeEach(() => {
    service = new MockServiceIntegration();
  });

  describe('API Rate Limiting', () => {
    test('respects rate limits', async () => {
      const requests = Array(15).fill(null).map(() => 
        service.makeRequest('/api/test')
      );

      const results = await Promise.allSettled(requests);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const rateLimited = results.filter(r => 
        r.status === 'rejected' && 
        (r.reason as Error).message.includes('Rate limit')
      ).length;

      expect(successful).toBe(10);
      expect(rateLimited).toBe(5);
    });

    test('resets rate limit window', async () => {
      // Fill up rate limit
      const initialRequests = Array(10).fill(null).map(() => 
        service.makeRequest('/api/test')
      );
      await Promise.all(initialRequests);

      // Next request should fail
      await expect(service.makeRequest('/api/test'))
        .rejects.toThrow('Rate limit exceeded');

      // Mock time passing (in real scenario, would wait)
      service['rateLimiter'].windowStart = Date.now() - 61000;

      // Should work again
      await expect(service.makeRequest('/api/test'))
        .resolves.toBeDefined();
    });
  });

  describe('Timeout Handling', () => {
    test('handles slow responses', async () => {
      service.setResponseDelay(2000);

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 1500)
      );

      await expect(
        Promise.race([
          service.makeRequest('/api/slow'),
          timeoutPromise
        ])
      ).rejects.toThrow('Request timeout');
    });

    test('implements request timeouts', async () => {
      service.setResponseDelay(3000);

      const requestWithTimeout = async (endpoint: string, timeoutMs: number) => {
        return Promise.race([
          service.makeRequest(endpoint),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), timeoutMs)
          )
        ]);
      };

      await expect(requestWithTimeout('/api/test', 1000))
        .rejects.toThrow('Timeout');
    });
  });

  describe('Fallback Mechanisms', () => {
    test('uses fallback when service fails', async () => {
      service.setFailureRate(100); // 100% failure rate

      const fallbackData = { message: 'Cached data' };
      const result = await service.makeRequestWithFallback('/api/test', fallbackData);

      expect(result.fromFallback).toBe(true);
      expect(result.data).toEqual(fallbackData);
    });

    test('prefers live data when available', async () => {
      service.setFailureRate(0); // No failures

      const fallbackData = { message: 'Cached data' };
      const result = await service.makeRequestWithFallback('/api/test', fallbackData);

      expect(result.fromFallback).toBeUndefined();
      expect(result.data).toContain('Response from');
    });

    test('implements retry with exponential backoff', async () => {
      service.setFailureRate(80); // High failure rate

      const startTime = Date.now();
      
      try {
        await service.makeRequestWithRetry('/api/unstable', 2);
      } catch (error) {
        const duration = Date.now() - startTime;
        expect(duration).toBeGreaterThan(3000); // Should have waited for retries
      }
    });

    test('succeeds on retry after initial failure', async () => {
      let callCount = 0;
      const originalMakeRequest = service.makeRequest.bind(service);
      
      service.makeRequest = async function(endpoint: string) {
        callCount++;
        if (callCount <= 2) {
          throw new Error('Service temporarily unavailable');
        }
        return originalMakeRequest(endpoint);
      };

      const result = await service.makeRequestWithRetry('/api/test');
      expect(result.status).toBe(200);
      expect(callCount).toBe(3);
    });
  });

  describe('Service Health Monitoring', () => {
    test('tracks service availability', async () => {
      const healthCheck = async (): Promise<boolean> => {
        try {
          await service.makeRequest('/health');
          return true;
        } catch {
          return false;
        }
      };

      // Service should be healthy initially
      expect(await healthCheck()).toBe(true);

      // Make service unhealthy
      service.setFailureRate(100);
      expect(await healthCheck()).toBe(false);

      // Restore service
      service.setFailureRate(0);
      expect(await healthCheck()).toBe(true);
    });

    test('implements circuit breaker pattern', async () => {
      class CircuitBreaker {
        private failures = 0;
        private threshold = 3;
        private isOpen = false;

        async execute<T>(fn: () => Promise<T>): Promise<T> {
          if (this.isOpen) {
            throw new Error('Circuit breaker is open');
          }

          try {
            const result = await fn();
            this.failures = 0; // Reset on success
            return result;
          } catch (error) {
            this.failures++;
            if (this.failures >= this.threshold) {
              this.isOpen = true;
            }
            throw error;
          }
        }
      }

      const circuitBreaker = new CircuitBreaker();
      service.setFailureRate(100);

      // First few failures should pass through
      for (let i = 0; i < 3; i++) {
        await expect(
          circuitBreaker.execute(() => service.makeRequest('/api/test'))
        ).rejects.toThrow('Service temporarily unavailable');
      }

      // Circuit should now be open
      await expect(
        circuitBreaker.execute(() => service.makeRequest('/api/test'))
      ).rejects.toThrow('Circuit breaker is open');
    });
  });
});