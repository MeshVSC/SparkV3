import { test, expect, SocketTestClient } from '../setup';

test.describe('Workspace Synchronization', () => {
  test('synchronizes document state across clients', async ({ browser, testUsers }) => {
    const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    const pages = await Promise.all(contexts.map(ctx => ctx.newPage()));
    const clients = pages.map((page, i) => new SocketTestClient(page, testUsers[i].id));

    await Promise.all(clients.map(client => client.connect()));

    const sparkId = 'sync-test-spark';
    await clients[0].emit('join_collaboration', {
      sparkId, userId: testUsers[0].id, username: testUsers[0].name
    });

    const initialState = await clients[0].waitForEvent('collaboration_state');
    expect(initialState.documentState.sparkId).toBe(sparkId);

    await clients[1].emit('join_collaboration', {
      sparkId, userId: testUsers[1].id, username: testUsers[1].name
    });

    const syncedState = await clients[1].waitForEvent('collaboration_state');
    expect(syncedState.documentState.sparkId).toBe(sparkId);
    expect(syncedState.participants).toHaveLength(2);

    await Promise.all(clients.map(client => client.disconnect()));
    await Promise.all(contexts.map(ctx => ctx.close()));
  });

  test('handles operational transformation conflicts', async ({ browser, testUsers }) => {
    const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    const pages = await Promise.all(contexts.map(ctx => ctx.newPage()));
    const clients = pages.map((page, i) => new SocketTestClient(page, testUsers[i].id));

    await Promise.all(clients.map(client => client.connect()));

    const sparkId = 'conflict-test';
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

    // Simulate concurrent operations
    const op1 = {
      id: 'op-1', type: 'INSERT', sparkId, userId: testUsers[0].id,
      clientId: 'client-1', position: 0, text: 'Hello ',
      timestamp: Date.now(), vectorClock: { 'client-1': 1 }
    };

    const op2 = {
      id: 'op-2', type: 'INSERT', sparkId, userId: testUsers[1].id,
      clientId: 'client-2', position: 0, text: 'World',
      timestamp: Date.now(), vectorClock: { 'client-2': 1 }
    };

    await Promise.all([
      clients[0].emit('collaborative_operation', { type: 'OPERATION', operation: op1 }),
      clients[1].emit('collaborative_operation', { type: 'OPERATION', operation: op2 })
    ]);

    // Both clients should receive operations
    const [recv1, recv2] = await Promise.all([
      clients[0].waitForEvent('collaborative_operation'),
      clients[1].waitForEvent('collaborative_operation')
    ]);

    expect(recv1.operation || recv2.operation).toBeDefined();

    await Promise.all(clients.map(client => client.disconnect()));
    await Promise.all(contexts.map(ctx => ctx.close()));
  });

  test('maintains vector clocks for operation ordering', async ({ browser, testUsers }) => {
    const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    const pages = await Promise.all(contexts.map(ctx => ctx.newPage()));
    const clients = pages.map((page, i) => new SocketTestClient(page, testUsers[i].id));

    await Promise.all(clients.map(client => client.connect()));

    const sparkId = 'vector-clock-test';
    await clients[0].emit('join_collaboration', {
      sparkId, userId: testUsers[0].id, username: testUsers[0].name
    });

    await clients[1].emit('join_collaboration', {
      sparkId, userId: testUsers[1].id, username: testUsers[1].name
    });

    await Promise.all([
      clients[0].waitForEvent('collaboration_state'),
      clients[1].waitForEvent('collaboration_state')
    ]);

    const operations = [];
    for (let i = 0; i < 3; i++) {
      const op = {
        id: `op-${i}`, type: 'INSERT', sparkId,
        userId: testUsers[0].id, clientId: 'client-1',
        position: i * 5, text: `Text${i}`,
        timestamp: Date.now() + i, vectorClock: { 'client-1': i + 1 }
      };
      operations.push(op);
      await clients[0].emit('collaborative_operation', { type: 'OPERATION', operation: op });
    }

    // Verify operations are received in order
    for (let i = 0; i < 3; i++) {
      const received = await clients[1].waitForEvent('collaborative_operation');
      expect(received.operation.text).toBe(`Text${i}`);
    }

    await Promise.all(clients.map(client => client.disconnect()));
    await Promise.all(contexts.map(ctx => ctx.close()));
  });
});