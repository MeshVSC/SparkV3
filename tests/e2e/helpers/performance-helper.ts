import { Page } from '@playwright/test';

export class PerformanceHelper {
  private page: Page;
  private startTime: number = 0;
  private metrics: any = {};

  constructor(page: Page) {
    this.page = page;
  }

  async startMeasurement() {
    this.startTime = Date.now();
    this.metrics = {};
    
    // Start performance monitoring
    await this.page.evaluate(() => {
      (window as any).__performanceMetrics = {
        pageLoadStart: performance.now(),
        consoleErrors: [],
        networkRequests: [],
        memoryUsage: {},
      };

      // Monitor console errors
      const originalError = console.error;
      console.error = (...args: any[]) => {
        (window as any).__performanceMetrics.consoleErrors.push({
          timestamp: performance.now(),
          message: args.join(' '),
        });
        originalError.apply(console, args);
      };
    });

    // Monitor network requests
    this.page.on('response', (response) => {
      this.metrics.networkRequests = this.metrics.networkRequests || [];
      this.metrics.networkRequests.push({
        url: response.url(),
        status: response.status(),
        timing: response.timing(),
        size: response.headers()['content-length'],
      });
    });
  }

  async measurePageLoad(url: string) {
    const startTime = Date.now();
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    return {
      loadTime,
      url,
      timestamp: new Date().toISOString(),
    };
  }

  async getMemoryUsage() {
    return await this.page.evaluate(() => {
      if ('memory' in performance) {
        return {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
        };
      }
      return null;
    });
  }

  async checkForInfiniteLoops(timeoutMs: number = 5000): Promise<boolean> {
    let isInfiniteLoop = false;
    
    const timeout = setTimeout(() => {
      isInfiniteLoop = true;
    }, timeoutMs);

    try {
      await this.page.evaluate((timeoutMs) => {
        return new Promise<void>((resolve) => {
          const start = performance.now();
          const checkLoop = () => {
            const now = performance.now();
            if (now - start > timeoutMs) {
              resolve();
            } else {
              requestAnimationFrame(checkLoop);
            }
          };
          checkLoop();
        });
      }, timeoutMs);
    } finally {
      clearTimeout(timeout);
    }

    return isInfiniteLoop;
  }

  async getConsoleErrors() {
    return await this.page.evaluate(() => {
      return (window as any).__performanceMetrics?.consoleErrors || [];
    });
  }

  async measureInteraction(selector: string, action: 'click' | 'type' | 'hover', value?: string) {
    const startTime = performance.now();
    
    switch (action) {
      case 'click':
        await this.page.click(selector);
        break;
      case 'type':
        if (value) await this.page.fill(selector, value);
        break;
      case 'hover':
        await this.page.hover(selector);
        break;
    }
    
    const endTime = performance.now();
    return {
      selector,
      action,
      duration: endTime - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  async generatePerformanceReport() {
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;
    const memoryUsage = await this.getMemoryUsage();
    const consoleErrors = await this.getConsoleErrors();

    return {
      summary: {
        totalDuration,
        startTime: this.startTime,
        endTime,
      },
      memoryUsage,
      consoleErrors: consoleErrors.length,
      consoleErrorDetails: consoleErrors,
      networkRequests: this.metrics.networkRequests || [],
      networkStats: {
        totalRequests: this.metrics.networkRequests?.length || 0,
        failedRequests: this.metrics.networkRequests?.filter((r: any) => r.status >= 400).length || 0,
        averageResponseTime: this.calculateAverageResponseTime(),
      },
    };
  }

  private calculateAverageResponseTime(): number {
    const requests = this.metrics.networkRequests || [];
    if (requests.length === 0) return 0;
    
    const totalTime = requests.reduce((sum: number, req: any) => {
      return sum + (req.timing?.responseEnd - req.timing?.requestStart || 0);
    }, 0);
    
    return totalTime / requests.length;
  }

  async waitForStablePerformance(maxWaitTime: number = 10000) {
    const startTime = Date.now();
    let lastMemoryReading = await this.getMemoryUsage();
    
    while (Date.now() - startTime < maxWaitTime) {
      await this.page.waitForTimeout(1000);
      const currentMemory = await this.getMemoryUsage();
      
      if (lastMemoryReading && currentMemory) {
        const memoryDiff = Math.abs(currentMemory.usedJSHeapSize - lastMemoryReading.usedJSHeapSize);
        if (memoryDiff < 100000) { // Less than 100KB change
          return true;
        }
      }
      
      lastMemoryReading = currentMemory;
    }
    
    return false;
  }

  async detectMemoryLeaks() {
    const initialMemory = await this.getMemoryUsage();
    
    // Perform some actions that should not increase memory significantly
    await this.page.reload();
    await this.page.waitForLoadState('networkidle');
    
    const finalMemory = await this.getMemoryUsage();
    
    if (initialMemory && finalMemory) {
      const memoryIncrease = finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize;
      const increasePercentage = (memoryIncrease / initialMemory.usedJSHeapSize) * 100;
      
      return {
        hasLeak: increasePercentage > 10, // More than 10% increase suggests a leak
        initialMemory: initialMemory.usedJSHeapSize,
        finalMemory: finalMemory.usedJSHeapSize,
        increase: memoryIncrease,
        increasePercentage,
      };
    }
    
    return null;
  }
}