"use client"

import { useEffect, useState } from "react"
import { socketClient } from "@/lib/socket-client"
import { Socket } from "socket.io-client"

export function useSocket(): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    const connectSocket = async () => {
      try {
        await socketClient.connect()
        // Get the underlying socket instance
        setSocket((socketClient as any).socket)
      } catch (error) {
        console.error("Failed to connect socket:", error)
      }
    }

    if (!socketClient.isConnected()) {
      connectSocket()
    } else {
      setSocket((socketClient as any).socket)
    }

    return () => {
      // Don't disconnect on unmount, let the singleton manage it
      setSocket(null)
    }
  }, [])

  return socket
}