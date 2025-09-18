import { test, expect, SocketTestClient } from '../setup';

test.describe('Socket.IO Connection Tests', () => {
  test('should establish socket connection successfully', async ({ page, testUsers }) => {
    const client = new SocketTestClient(page, testUsers[0].id);
    
    await test.step('Connect to socket server', async () => {
      await client.connect();
      
      const isConnected = await page.evaluate(() => 
        (window as any).testSocket?.connected === true
      );
      expect(isConnected).toBe(true);
    });

    await client.disconnect();
  });

  test('should handle multiple simultaneous connections', async ({ browser, testUsers }) => {
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext()
    ]);

    const pages = await Promise.all(
      contexts.map(context => context.newPage())
    );

    const clients = pages.map((page, index) => 
      new SocketTestClient(page, testUsers[index]?.id || `test-${index}`)
    );

    await test.step('Connect multiple clients', async () => {
      await Promise.all(clients.map(client => client.connect()));

      const connectionStates = await Promise.all(
        pages.map(page => 
          page.evaluate(() => (window as any).testSocket?.connected === true)
        )
      );

      connectionStates.forEach(connected => expect(connected).toBe(true));
    });

    await test.step('Clean up connections', async () => {
      await Promise.all(clients.map(client => client.disconnect()));
      await Promise.all(contexts.map(context => context.close()));
    });
  });
});