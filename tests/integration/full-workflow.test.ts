import { test, expect, SocketTestClient } from '../setup';
import { PageHelpers } from '../utils/test-helpers';

test.describe('Full Workflow Integration', () => {
  test('complete collaboration workflow', async ({ browser, testUsers }) => {
    const [adminContext, userContext] = await Promise.all([
      browser.newContext(),
      browser.newContext()
    ]);

    const [adminPage, userPage] = await Promise.all([
      adminContext.newPage(),
      userContext.newPage()
    ]);

    await PageHelpers.loginUser(adminPage, testUsers[0]);
    await adminPage.goto('/workspaces');
    await adminPage.click('[data-testid="create-workspace-button"]');
    await adminPage.fill('[data-testid="workspace-name-input"]', 'Collab Workspace');
    await adminPage.click('[data-testid="create-workspace-submit"]');

    await PageHelpers.loginUser(userPage, testUsers[1]);
    await userPage.goto('/workspaces');
    await userPage.click('text=Collab Workspace');
    await userPage.click('[data-testid="join-workspace-button"]');

    const adminClient = new SocketTestClient(adminPage, testUsers[0].id);
    const userClient = new SocketTestClient(userPage, testUsers[1].id);

    await Promise.all([adminClient.connect(), userClient.connect()]);

    const sparkId = 'integration-test-spark';
    await Promise.all([
      adminClient.emit('join_collaboration', {
        sparkId, userId: testUsers[0].id, username: testUsers[0].name
      }),
      userClient.emit('join_collaboration', {
        sparkId, userId: testUsers[1].id, username: testUsers[1].name
      })
    ]);

    await Promise.all([
      adminClient.waitForEvent('collaboration_state'),
      userClient.waitForEvent('collaboration_state')
    ]);

    await adminClient.emit('collaborative_operation', {
      type: 'OPERATION',
      operation: {
        id: 'final-op', type: 'INSERT', sparkId,
        userId: testUsers[0].id, clientId: 'admin-client',
        position: 0, text: 'Final test content',
        timestamp: Date.now(), vectorClock: { 'admin-client': 1 }
      }
    });

    const receivedOp = await userClient.waitForEvent('collaborative_operation');
    expect(receivedOp.operation.text).toBe('Final test content');

    await Promise.all([adminClient.disconnect(), userClient.disconnect()]);
    await Promise.all([adminContext.close(), userContext.close()]);
  });
});