import { io, Socket } from "socket.io-client";

const URL = process.env.NEXT_PUBLIC_SOCKET_IO_URL || "http://localhost:3000";

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  // Only create socket in browser environment
  if (typeof window === 'undefined') {
    return null;
  }
  
  if (!socket) {
    socket = io(URL, {
      path: '/api/socketio',
      transports: ["websocket", "polling"],
      autoConnect: false, // Don't auto-connect
      reconnection: false, // Disable reconnection to prevent infinite loops
      timeout: 5000,
      withCredentials: true,
    });
    (window as any).__socketClient = socket;
  }
  return socket;
}

export default getSocket;
