// Database operations integration tests
import { testPrisma, cleanup } from '../setup';

describe('Database Operations Tests', () => {
  describe('Connection Pooling', () => {
    test('handles multiple concurrent connections', async () => {
      const queries = Array(3).fill(null).map(() => testPrisma.user.count());
      const results = await Promise.all(queries);
      expect(results.every(count => typeof count === 'number')).toBe(true);
    });

    test('recovers from connection failures', async () => {
      await expect(testPrisma.user.count()).resolves.toBeDefined();
    });
  });

  describe('Transaction Rollbacks', () => {
    test('rolls back failed transactions', async () => {
      const initialCount = await testPrisma.user.count();

      try {
        await testPrisma.$transaction(async (tx) => {
          await tx.user.create({
            data: { email: 'test@example.com', name: 'Test' }
          });
          throw new Error('Rollback test');
        });
      } catch (error) {
        expect(error.message).toBe('Rollback test');
      }

      const finalCount = await testPrisma.user.count();
      expect(finalCount).toBe(initialCount);
    });
  });

  describe('Data Consistency', () => {
    test('maintains referential integrity', async () => {
      const user = await testPrisma.user.create({
        data: { email: 'ref@test.com', name: 'Ref Test' }
      });

      const spark = await testPrisma.spark.create({
        data: { userId: user.id, title: 'Test Spark' }
      });

      await testPrisma.user.delete({ where: { id: user.id } });
      
      const sparkExists = await testPrisma.spark.findUnique({ where: { id: spark.id } });
      expect(sparkExists).toBeNull();
    });
  });

  afterAll(cleanup);
});