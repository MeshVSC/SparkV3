import { useEffect, useMemo, useRef, useState } from 'react'

export type Cursor = { x: number; y: number }
export type PresenceUser = { id: string; name?: string; cursor?: Cursor; editingSparkId?: string }

export interface PresenceAPI {
  onlineUsers: PresenceUser[]
  updateCursor: (pos: Cursor) => void
  startEditingSpark: (sparkId: string) => void
  endEditingSpark: (sparkId: string) => void
  broadcastSparkChange: (sparkId: string, payload?: any) => void
  isConnected: boolean
}

function getSocket(): any | null {
  if (typeof window === 'undefined') return null
  const w = window as any
  return w.__socketClient || null
}

export function useDemoPresence(roomId: string = 'default'): PresenceAPI {
  const socket = useMemo(() => getSocket(), [])
  const [isConnected, setIsConnected] = useState<boolean>(!!socket)
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([])
  const myIdRef = useRef<string>('')

  // Helpers
  const upsertUser = (u: PresenceUser) => {
    setOnlineUsers(prev => {
      const i = prev.findIndex(p => p.id === u.id)
      if (i === -1) return [...prev, u]
      const copy = prev.slice()
      copy[i] = { ...copy[i], ...u }
      return copy
    })
  }
  const removeUser = (id: string) => setOnlineUsers(prev => prev.filter(u => u.id !== id))

  useEffect(() => {
    if (!socket) return

    // Join room
    try { socket.emit?.('presence:join', { roomId }) } catch {}

    const onConnect = () => setIsConnected(true)
    const onDisconnect = () => setIsConnected(false)
    const onState = (state: { users: PresenceUser[]; selfId?: string }) => {
      if (state?.selfId) myIdRef.current = state.selfId
      setOnlineUsers(state?.users || [])
    }
    const onJoined = (u: PresenceUser) => upsertUser(u)
    const onLeft = (id: string | { id: string }) => removeUser(typeof id === 'string' ? id : id.id)
    const onCursor = (p: { id: string; cursor: Cursor }) => upsertUser({ id: p.id, cursor: p.cursor })
    const onEditStart = (p: { id: string; sparkId: string }) => upsertUser({ id: p.id, editingSparkId: p.sparkId })
    const onEditEnd = (p: { id: string }) => upsertUser({ id: p.id, editingSparkId: undefined })

    socket.on?.('connect', onConnect)
    socket.on?.('disconnect', onDisconnect)
    socket.on?.('presence:state', onState)
    socket.on?.('presence:user_joined', onJoined)
    socket.on?.('presence:user_left', onLeft)
    socket.on?.('presence:cursor', onCursor)
    socket.on?.('presence:editing_start', onEditStart)
    socket.on?.('presence:editing_end', onEditEnd)

    // Request current state
    try { socket.emit?.('presence:state:request', { roomId }) } catch {}

    return () => {
      socket.off?.('connect', onConnect)
      socket.off?.('disconnect', onDisconnect)
      socket.off?.('presence:state', onState)
      socket.off?.('presence:user_joined', onJoined)
      socket.off?.('presence:user_left', onLeft)
      socket.off?.('presence:cursor', onCursor)
      socket.off?.('presence:editing_start', onEditStart)
      socket.off?.('presence:editing_end', onEditEnd)
      try { socket.emit?.('presence:leave', { roomId }) } catch {}
    }
  }, [socket, roomId])

  const updateCursor = (pos: Cursor) => {
    if (!socket) return
    try { socket.emit?.('presence:cursor', { roomId, cursor: pos }) } catch {}
  }

  const startEditingSpark = (sparkId: string) => {
    if (!socket) return
    try { socket.emit?.('presence:editing_start', { roomId, sparkId }) } catch {}
  }

  const endEditingSpark = (sparkId: string) => {
    if (!socket) return
    try { socket.emit?.('presence:editing_end', { roomId, sparkId }) } catch {}
  }

  const broadcastSparkChange = (sparkId: string, payload?: any) => {
    if (!socket) return
    try { socket.emit?.('presence:spark_change', { roomId, sparkId, payload }) } catch {}
  }

  return { onlineUsers, updateCursor, startEditingSpark, endEditingSpark, broadcastSparkChange, isConnected }
}

// Simple passthrough provider for legacy imports
export const PresenceProvider: React.FC<React.PropsWithChildren> = ({ children }) => children as any

export default useDemoPresence
