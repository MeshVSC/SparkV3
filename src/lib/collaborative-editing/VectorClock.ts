import { VectorClock } from '@/types/collaborative-editing';

/**
 * Vector Clock implementation for tracking logical time in collaborative editing
 * Helps determine causal relationships between operations
 */
export class VectorClockManager {
  /**
   * Initialize a new vector clock for a client
   */
  static init(clientId: string): VectorClock {
    return { [clientId]: 0 };
  }

  /**
   * Increment the vector clock for a specific client
   */
  static increment(clock: VectorClock, clientId: string): VectorClock {
    return {
      ...clock,
      [clientId]: (clock[clientId] || 0) + 1
    };
  }

  /**
   * Merge two vector clocks, taking the maximum value for each client
   */
  static merge(clock1: VectorClock, clock2: VectorClock): VectorClock {
    const result: VectorClock = { ...clock1 };
    
    for (const clientId in clock2) {
      result[clientId] = Math.max(result[clientId] || 0, clock2[clientId]);
    }
    
    return result;
  }

  /**
   * Compare two vector clocks to determine their relationship
   * Returns: 'before' | 'after' | 'concurrent' | 'equal'
   */
  static compare(clock1: VectorClock, clock2: VectorClock): 'before' | 'after' | 'concurrent' | 'equal' {
    const allClients = new Set([...Object.keys(clock1), ...Object.keys(clock2)]);
    
    let clock1Greater = false;
    let clock2Greater = false;
    
    for (const clientId of allClients) {
      const val1 = clock1[clientId] || 0;
      const val2 = clock2[clientId] || 0;
      
      if (val1 > val2) {
        clock1Greater = true;
      } else if (val2 > val1) {
        clock2Greater = true;
      }
    }
    
    if (clock1Greater && clock2Greater) {
      return 'concurrent';
    } else if (clock1Greater) {
      return 'after';
    } else if (clock2Greater) {
      return 'before';
    } else {
      return 'equal';
    }
  }

  /**
   * Check if clock1 happens before clock2
   */
  static happensBefore(clock1: VectorClock, clock2: VectorClock): boolean {
    return this.compare(clock1, clock2) === 'before';
  }

  /**
   * Check if two events are concurrent
   */
  static areConcurrent(clock1: VectorClock, clock2: VectorClock): boolean {
    return this.compare(clock1, clock2) === 'concurrent';
  }

  /**
   * Get the logical timestamp for a specific client
   */
  static getTime(clock: VectorClock, clientId: string): number {
    return clock[clientId] || 0;
  }

  /**
   * Create a copy of the vector clock
   */
  static copy(clock: VectorClock): VectorClock {
    return { ...clock };
  }

  /**
   * Get all client IDs in the vector clock
   */
  static getClients(clock: VectorClock): string[] {
    return Object.keys(clock);
  }

  /**
   * Get the maximum timestamp across all clients
   */
  static getMaxTime(clock: VectorClock): number {
    return Math.max(...Object.values(clock), 0);
  }

  /**
   * Clean up old entries from the vector clock
   * Removes clients that haven't been active for a specified duration
   */
  static cleanup(clock: VectorClock, activeClients: string[]): VectorClock {
    const cleaned: VectorClock = {};
    
    for (const clientId of activeClients) {
      if (clock[clientId] !== undefined) {
        cleaned[clientId] = clock[clientId];
      }
    }
    
    return cleaned;
  }

  /**
   * Serialize vector clock to string for storage/transmission
   */
  static serialize(clock: VectorClock): string {
    return JSON.stringify(clock);
  }

  /**
   * Deserialize vector clock from string
   */
  static deserialize(serialized: string): VectorClock {
    try {
      return JSON.parse(serialized);
    } catch {
      return {};
    }
  }

  /**
   * Calculate the "distance" between two vector clocks
   * Used for conflict resolution priority
   */
  static distance(clock1: VectorClock, clock2: VectorClock): number {
    const allClients = new Set([...Object.keys(clock1), ...Object.keys(clock2)]);
    let distance = 0;
    
    for (const clientId of allClients) {
      const val1 = clock1[clientId] || 0;
      const val2 = clock2[clientId] || 0;
      distance += Math.abs(val1 - val2);
    }
    
    return distance;
  }
}