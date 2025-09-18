import { test, expect, SocketTestClient } from '../setup';

test.describe('Collaborative Editing Conflicts', () => {
  test('resolves concurrent insert operations', async ({ browser, testUsers }) => {
    const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    const pages = await Promise.all(contexts.map(ctx => ctx.newPage()));
    const clients = pages.map((page, i) => new SocketTestClient(page, testUsers[i].id));

    await Promise.all(clients.map(client => client.connect()));

    const sparkId = 'conflict-resolution-test';
    await Promise.all([
      clients[0].emit('join_collaboration', {
        sparkId, userId: testUsers[0].id, username: testUsers[0].name
      }),
      clients[1].emit('join_collaboration', {
        sparkId, userId: testUsers[1].id, username: testUsers[1].name
      })
    ]);

    await Promise.all([
      clients[0].waitForEvent('collaboration_state'),
      clients[1].waitForEvent('collaboration_state')
    ]);

    // Concurrent inserts at same position
    const timestamp = Date.now();
    await Promise.all([
      clients[0].emit('collaborative_operation', {
        type: 'OPERATION',
        operation: {
          id: 'op-1', type: 'INSERT', sparkId, userId: testUsers[0].id,
          clientId: 'client-1', position: 0, text: 'Hello ',
          timestamp, vectorClock: { 'client-1': 1 }
        }
      }),
      clients[1].emit('collaborative_operation', {
        type: 'OPERATION',
        operation: {
          id: 'op-2', type: 'INSERT', sparkId, userId: testUsers[1].id,
          clientId: 'client-2', position: 0, text: 'World',
          timestamp: timestamp + 1, vectorClock: { 'client-2': 1 }
        }
      })
    ]);

    // Both should receive transformed operations
    const [op1Result, op2Result] = await Promise.all([
      clients[1].waitForEvent('collaborative_operation'),
      clients[0].waitForEvent('collaborative_operation')
    ]);

    expect(op1Result.operation || op2Result.operation).toBeDefined();

    await Promise.all(clients.map(client => client.disconnect()));
    await Promise.all(contexts.map(ctx => ctx.close()));
  });

  test('handles delete-insert conflicts', async ({ browser, testUsers }) => {
    const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    const pages = await Promise.all(contexts.map(ctx => ctx.newPage()));
    const clients = pages.map((page, i) => new SocketTestClient(page, testUsers[i].id));

    await Promise.all(clients.map(client => client.connect()));

    const sparkId = 'delete-insert-conflict';
    await Promise.all([
      clients[0].emit('join_collaboration', {
        sparkId, userId: testUsers[0].id, username: testUsers[0].name
      }),
      clients[1].emit('join_collaboration', {
        sparkId, userId: testUsers[1].id, username: testUsers[1].name
      })
    ]);

    await Promise.all([
      clients[0].waitForEvent('collaboration_state'),
      clients[1].waitForEvent('collaboration_state')
    ]);

    const timestamp = Date.now();
    
    // One client deletes while another inserts
    await clients[0].emit('collaborative_operation', {
      type: 'OPERATION',
      operation: {
        id: 'delete-op', type: 'DELETE', sparkId,
        userId: testUsers[0].id, clientId: 'client-1',
        position: 0, length: 5, timestamp,
        vectorClock: { 'client-1': 1 }
      }
    });

    await clients[1].emit('collaborative_operation', {
      type: 'OPERATION',
      operation: {
        id: 'insert-op', type: 'INSERT', sparkId,
        userId: testUsers[1].id, clientId: 'client-2',
        position: 2, text: 'NEW', timestamp: timestamp + 1,
        vectorClock: { 'client-2': 1 }
      }
    });

    // Operations should be transformed and applied
    const [deleteResult, insertResult] = await Promise.all([
      clients[1].waitForEvent('collaborative_operation'),
      clients[0].waitForEvent('collaborative_operation')
    ]);

    expect(deleteResult.operation.type).toBe('DELETE');
    expect(insertResult.operation.type).toBe('INSERT');

    await Promise.all(clients.map(client => client.disconnect()));
    await Promise.all(contexts.map(ctx => ctx.close()));
  });

  test('maintains causality with vector clocks', async ({ browser, testUsers }) => {
    const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    const pages = await Promise.all(contexts.map(ctx => ctx.newPage()));
    const clients = pages.map((page, i) => new SocketTestClient(page, testUsers[i].id));

    await Promise.all(clients.map(client => client.connect()));

    const sparkId = 'causality-test';
    await Promise.all([
      clients[0].emit('join_collaboration', {
        sparkId, userId: testUsers[0].id, username: testUsers[0].name
      }),
      clients[1].emit('join_collaboration', {
        sparkId, userId: testUsers[1].id, username: testUsers[1].name
      })
    ]);

    await Promise.all([
      clients[0].waitForEvent('collaboration_state'),
      clients[1].waitForEvent('collaboration_state')
    ]);

    // Sequential operations with proper vector clock advancement
    const operations = [
      {
        id: 'seq-1', type: 'INSERT', sparkId, userId: testUsers[0].id,
        clientId: 'client-1', position: 0, text: 'First ',
        timestamp: Date.now(), vectorClock: { 'client-1': 1 }
      },
      {
        id: 'seq-2', type: 'INSERT', sparkId, userId: testUsers[0].id,
        clientId: 'client-1', position: 6, text: 'Second ',
        timestamp: Date.now() + 100, vectorClock: { 'client-1': 2 }
      }
    ];

    for (const op of operations) {
      await clients[0].emit('collaborative_operation', {
        type: 'OPERATION', operation: op
      });
      
      const received = await clients[1].waitForEvent('collaborative_operation');
      expect(received.operation.id).toBe(op.id);
      expect(received.vectorClock['client-1']).toBeGreaterThanOrEqual(op.vectorClock['client-1']);
    }

    await Promise.all(clients.map(client => client.disconnect()));
    await Promise.all(contexts.map(ctx => ctx.close()));
  });

  test('handles state reconciliation after network partition', async ({ browser, testUsers }) => {
    const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    const pages = await Promise.all(contexts.map(ctx => ctx.newPage()));
    const clients = pages.map((page, i) => new SocketTestClient(page, testUsers[i].id));

    await Promise.all(clients.map(client => client.connect()));

    const sparkId = 'reconciliation-test';
    await clients[0].emit('join_collaboration', {
      sparkId, userId: testUsers[0].id, username: testUsers[0].name
    });
    await clients[0].waitForEvent('collaboration_state');

    // Simulate network partition - disconnect client 2
    await clients[1].connect();
    await clients[1].emit('join_collaboration', {
      sparkId, userId: testUsers[1].id, username: testUsers[1].name
    });
    await clients[1].waitForEvent('collaboration_state');
    await clients[1].disconnect();

    // Client 1 makes changes while client 2 is disconnected
    await clients[0].emit('collaborative_operation', {
      type: 'OPERATION',
      operation: {
        id: 'partition-op', type: 'INSERT', sparkId,
        userId: testUsers[0].id, clientId: 'client-1',
        position: 0, text: 'During partition ',
        timestamp: Date.now(), vectorClock: { 'client-1': 1 }
      }
    });

    // Client 2 reconnects
    await clients[1].connect();
    await clients[1].emit('join_collaboration', {
      sparkId, userId: testUsers[1].id, username: testUsers[1].name
    });

    // Should receive sync with operations made during partition
    const syncState = await clients[1].waitForEvent('collaboration_state');
    expect(syncState.recentOperations).toBeDefined();
    expect(syncState.recentOperations.length).toBeGreaterThan(0);

    await Promise.all(clients.map(client => client.disconnect()));
    await Promise.all(contexts.map(ctx => ctx.close()));
  });
});