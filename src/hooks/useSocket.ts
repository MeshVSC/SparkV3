import { useEffect, useState } from 'react';
import { Socket, io } from 'socket.io-client';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const socketConnection = io({
      path: '/api/socketio',
      autoConnect: true
    });

    setSocket(socketConnection);

    return () => {
      socketConnection.disconnect();
    };
  }, []);

  return socket;
}