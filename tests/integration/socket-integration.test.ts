// Socket.IO integration tests
import { io, Socket } from 'socket.io-client';

describe('Socket.IO Integration', () => {
  let clientSocket: Socket;
  const serverPort = 3001;

  beforeAll((done) => {
    // Start test server
    clientSocket = io(`http://localhost:${serverPort}`, {
      transports: ['websocket']
    });
    
    clientSocket.on('connect', done);
  });

  afterAll(() => {
    clientSocket.close();
  });

  test('establishes connection', () => {
    expect(clientSocket.connected).toBe(true);
  });

  test('handles real-time spark updates', (done) => {
    const testData = { sparkId: '123', title: 'Updated Spark' };

    clientSocket.on('spark:updated', (data) => {
      expect(data).toEqual(testData);
      done();
    });

    clientSocket.emit('spark:update', testData);
  });

  test('handles connection drops and reconnection', (done) => {
    let reconnected = false;

    clientSocket.on('disconnect', () => {
      expect(clientSocket.connected).toBe(false);
    });

    clientSocket.on('connect', () => {
      if (reconnected) {
        expect(clientSocket.connected).toBe(true);
        done();
      }
      reconnected = true;
    });

    // Simulate connection drop
    clientSocket.disconnect();
    
    // Reconnect after delay
    setTimeout(() => {
      clientSocket.connect();
    }, 100);
  });

  test('handles message queuing during disconnect', (done) => {
    const messages: any[] = [];

    clientSocket.on('queued:message', (data) => {
      messages.push(data);
      if (messages.length === 2) {
        expect(messages).toContainEqual({ type: 'test1' });
        expect(messages).toContainEqual({ type: 'test2' });
        done();
      }
    });

    // Disconnect and queue messages
    clientSocket.disconnect();
    clientSocket.emit('queue:message', { type: 'test1' });
    clientSocket.emit('queue:message', { type: 'test2' });
    
    // Reconnect to receive queued messages
    setTimeout(() => {
      clientSocket.connect();
    }, 100);
  });
});