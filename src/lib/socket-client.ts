import { io, Socket } from "socket.io-client";

const URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3000";

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  // Only create socket in browser environment
  if (typeof window === 'undefined') {
    return null;
  }
  
  if (!socket) {
    socket = io(URL, {
      path: '/api/socketio',
      transports: ["websocket"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      withCredentials: true,
    });
    (window as any).__socketClient = socket;
  }
  return socket;
}

export default getSocket;
