import { test, expect, SocketTestClient } from '../setup';

test.describe('Message Broadcasting', () => {
  test('broadcasts messages between clients', async ({ browser, testUsers }) => {
    const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    const pages = await Promise.all(contexts.map(ctx => ctx.newPage()));
    const clients = pages.map((page, i) => new SocketTestClient(page, testUsers[i].id));

    await Promise.all(clients.map(client => client.connect()));

    const sparkId = 'test-spark-123';
    
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

    const operation = {
      id: 'op-1', type: 'INSERT', sparkId, userId: testUsers[0].id,
      clientId: 'client-1', position: 0, text: 'Hello World',
      timestamp: Date.now(), vectorClock: { 'client-1': 1 }
    };

    await clients[0].emit('collaborative_operation', { type: 'OPERATION', operation });
    const receivedOp = await clients[1].waitForEvent('collaborative_operation');
    
    expect(receivedOp.operation.text).toBe('Hello World');
    expect(receivedOp.operation.type).toBe('INSERT');

    await Promise.all(clients.map(client => client.disconnect()));
    await Promise.all(contexts.map(ctx => ctx.close()));
  });

  test('handles participant notifications', async ({ browser, testUsers }) => {
    const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    const pages = await Promise.all(contexts.map(ctx => ctx.newPage()));
    const clients = pages.map((page, i) => new SocketTestClient(page, testUsers[i].id));

    await clients[0].connect();
    await clients[0].emit('join_collaboration', {
      sparkId: 'test-spark-123', userId: testUsers[0].id, username: testUsers[0].name
    });
    await clients[0].waitForEvent('collaboration_state');

    await clients[1].connect();
    const joinPromise = clients[0].waitForEvent('participant_joined');
    
    await clients[1].emit('join_collaboration', {
      sparkId: 'test-spark-123', userId: testUsers[1].id, username: testUsers[1].name
    });

    const joinEvent = await joinPromise;
    expect(joinEvent.userId).toBe(testUsers[1].id);

    const leavePromise = clients[0].waitForEvent('participant_left');
    await clients[1].emit('leave_collaboration', { sparkId: 'test-spark-123' });
    const leaveEvent = await leavePromise;
    expect(leaveEvent.userId).toBe(testUsers[1].id);

    await Promise.all(clients.map(client => client.disconnect()));
    await Promise.all(contexts.map(ctx => ctx.close()));
  });
});