import { getSocketClient } from '@/lib/socket-client'
import { NotificationEvent } from '@/lib/socket-client'

// Enhanced example integration showing how to use the Socket.IO client with authentication and user-specific notifications
export class SocketIntegrationExample {
  private isConnected = false
  private isAuthenticated = false
  private socketClient: ReturnType<typeof getSocketClient>

  constructor() {
    this.socketClient = getSocketClient()
    this.setupSocketListeners()
  }

  // Authenticate and connect to the socket server
  async authenticate(token: string) {
    try {
      await this.socketClient.connect('/api/socketio', token)
      console.log('Socket authenticated successfully')
      return true
    } catch (error) {
      console.error('Socket authentication failed:', error)
      return false
    }
  }

  private setupSocketListeners() {
    // Connection and authentication events
    this.socketClient.on('connection_state_changed', (data) => {
      console.log('Connection state changed:', data.connected)
      this.isConnected = data.connected
    })

    this.socketClient.on('authenticated', (session) => {
      console.log('Authenticated as:', session.username, session.email)
      this.isAuthenticated = true
      
      // Show welcome message
      this.showNotification(`Welcome back, ${session.username}!`, 'medium')
    })

    this.socketClient.on('auth_error', (error) => {
      console.error('Authentication error:', error.message)
      this.showNotification(`Authentication failed: ${error.message}`, 'high')
    })

    // Enhanced notification events
    this.socketClient.on('notification_received', (notification: NotificationEvent) => {
      console.log('Notification received:', notification.title)
      this.showNotification(notification.message, notification.priority, notification)
      
      // Auto-acknowledge low priority notifications
      if (notification.priority === 'low') {
        setTimeout(() => {
          this.acknowledgeNotification(notification.id)
        }, 2000)
      }
    })

    this.socketClient.on('pending_notifications', (notifications: NotificationEvent[]) => {
      console.log(`Received ${notifications.length} pending notifications`)
      notifications.forEach(notification => {
        this.showNotification(`[Pending] ${notification.message}`, notification.priority, notification)
      })
    })

    // Collaboration events
    this.socketClient.on('user_joined', (data) => {
      console.log('User joined workspace:', data.user.username)
      this.showNotification(`${data.user.username} joined the workspace`, 'low')
    })

    this.socketClient.on('user_left', (data) => {
      console.log('User left workspace:', data.username)
      this.showNotification(`${data.username} left the workspace`, 'low')
    })

    this.socketClient.on('spark_editing_started', (data) => {
      console.log('User started editing spark:', data.username, data.sparkId)
      this.showNotification(`${data.username} is editing a spark`, 'low')
    })

    this.socketClient.on('spark_content_changed', (data) => {
      console.log('Spark content changed:', data.sparkId, 'by', data.username)
      this.handleSparkContentChange(data)
    })

    this.socketClient.on('presence_updated', (data) => {
      console.log('User presence updated:', data.userId, data.status)
    })

    // Heartbeat for connection health
    this.socketClient.on('heartbeat_ack', (data) => {
      console.log('Heartbeat acknowledged at:', data.timestamp)
    })
  }

  // Enhanced notification methods
  sendNotificationToUser(
    targetUserId: string,
    type: string,
    title: string,
    message: string,
    priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium',
    data?: Record<string, any>
  ): boolean {
    if (!this.isAuthenticated) {
      console.warn('Cannot send notification: not authenticated')
      return false
    }

    return this.socketClient.sendNotificationToUser(
      targetUserId,
      type,
      title,
      message,
      priority,
      data
    )
  }

  sendNotificationToWorkspace(
    workspaceId: string,
    type: string,
    title: string,
    message: string,
    priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium',
    data?: Record<string, any>
  ): boolean {
    if (!this.isAuthenticated) {
      console.warn('Cannot send notification: not authenticated')
      return false
    }

    return this.socketClient.sendNotificationToWorkspace(
      workspaceId,
      type,
      title,
      message,
      priority,
      data
    )
  }

  acknowledgeNotification(notificationId: string) {
    this.socketClient.acknowledgeNotification(notificationId)
  }

  // User presence and status
  async getUserPresence(): Promise<any[]> {
    try {
      const result = await this.socketClient.getUserPresence()
      return result.users
    } catch (error) {
      console.error('Failed to get user presence:', error)
      return []
    }
  }

  updateUserStatus(status: 'online' | 'away' | 'busy' | 'offline') {
    return this.socketClient.updateUserStatus(status)
  }

  // Join a workspace for collaboration (enhanced with authentication check)
  joinWorkspace(userId: string, username: string, workspaceId: string, avatar?: string): boolean {
    if (!this.isAuthenticated) {
      console.warn('Cannot join workspace: not authenticated')
      return false
    }

    return this.socketClient.joinWorkspace({ userId, username, workspaceId, avatar })
  }

  // Leave current workspace
  leaveWorkspace(workspaceId: string): boolean {
    return this.socketClient.leaveWorkspace(workspaceId)
  }

  // Start editing a spark (collaborative editing)
  startEditingSpark(sparkId: string): boolean {
    return this.socketClient.startEditingSpark(sparkId)
  }

  // End editing a spark
  endEditingSpark(sparkId: string): boolean {
    return this.socketClient.endEditingSpark(sparkId)
  }

  // Broadcast spark content changes
  broadcastSparkChange(
    sparkId: string, 
    content: string, 
    changeType: 'title' | 'description' | 'content' | 'status' | 'position',
    position?: { x: number; y: number }
  ): boolean {
    return this.socketClient.broadcastSparkChange({
      sparkId,
      content,
      changeType,
      position
    })
  }

  // Update presence status
  updatePresence(status: 'online' | 'idle' | 'away'): boolean {
    return this.socketClient.updatePresence(status)
  }

  // Legacy notification method (for backwards compatibility)
  sendNotification(
    text: string, 
    type: string = 'general', 
    priority: 'low' | 'medium' | 'high' = 'medium',
    targetUserId?: string
  ) {
    this.socketClient.sendNotification({
      text,
      type,
      priority,
      targetUserId,
      data: { timestamp: new Date().toISOString() }
    })
  }

  // Handle spark content changes from other users
  private handleSparkContentChange(data: any) {
    console.log('Handling spark change:', data)
    
    // Example: Update spark in your state management system
    // For React context:
    // sparkDispatch({ type: 'UPDATE_SPARK_CONTENT', payload: data })
    
    // For Zustand:
    // useSparkStore.getState().updateSparkContent(data.sparkId, data.content, data.changeType)
    
    // For Redux:
    // store.dispatch(updateSparkContent({ sparkId: data.sparkId, content: data.content, changeType: data.changeType }))
    
    // Show notification about the change
    if (data.changeType === 'title' || data.changeType === 'status') {
      this.showNotification(
        `${data.username} updated spark ${data.changeType}`,
        'low',
        { sparkId: data.sparkId, userId: data.userId }
      )
    }
  }

  // Enhanced notification display with different priorities
  private showNotification(
    message: string, 
    priority: 'low' | 'medium' | 'high' | 'urgent', 
    notification?: NotificationEvent | Record<string, any>
  ) {
    const priorityEmoji = {
      low: 'ℹ️',
      medium: '📢',
      high: '⚠️',
      urgent: '🚨'
    }

    console.log(`${priorityEmoji[priority]} [${priority.toUpperCase()}] ${message}`)
    
    // Integration examples for different notification systems:
    
    // 1. Browser notifications (for urgent messages)
    if (typeof window !== 'undefined' && priority === 'urgent' && 'Notification' in window && Notification.permission === 'granted') {
      const title = (notification as NotificationEvent)?.title || 'Urgent Message'
      new Notification(title, {
        body: message,
        icon: '/favicon.ico',
        tag: (notification as NotificationEvent)?.id
      })
    }

    // 2. Toast notifications (react-hot-toast example)
    // import { toast } from 'react-hot-toast'
    // switch (priority) {
    //   case 'urgent':
    //   case 'high':
    //     toast.error(message)
    //     break
    //   case 'medium':
    //     toast.success(message)
    //     break
    //   case 'low':
    //     toast(message)
    //     break
    // }

    // 3. Custom notification system
    // notificationStore.addNotification({
    //   id: (notification as NotificationEvent)?.id || Date.now().toString(),
    //   message,
    //   priority,
    //   timestamp: new Date(),
    //   data: (notification as NotificationEvent)?.data
    // })
  }

  // Get comprehensive connection status
  getConnectionStatus() {
    return {
      ...this.socketClient.getConnectionStatus(),
      isAuthenticated: this.isAuthenticated
    }
  }

  // Request browser notification permission (for urgent notifications)
  async requestNotificationPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('Browser does not support notifications')
      return false
    }

    if (Notification.permission === 'granted') {
      return true
    }

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission()
      return permission === 'granted'
    }

    return false
  }

  // Cleanup
  destroy() {
    this.socketClient.disconnect()
    this.isConnected = false
    this.isAuthenticated = false
  }
}

// Example usage with authentication:
/*
async function initializeSocketIntegration() {
  const socketIntegration = new SocketIntegrationExample()
  
  // Get auth token from your authentication system
  const authToken = localStorage.getItem('auth-token') || 'your-jwt-token'
  
  // Authenticate and connect
  const success = await socketIntegration.authenticate(authToken)
  if (success) {
    // Join workspace
    socketIntegration.joinWorkspace('user123', 'John Doe', 'workspace456', 'https://avatar.url')
    
    // Send notification to specific user
    socketIntegration.sendNotificationToUser(
      'user789',
      'spark_update',
      'Spark Updated',
      'Your spark has been updated by a collaborator',
      'medium',
      { sparkId: 'spark123', action: 'updated' }
    )
    
    // Send notification to entire workspace
    socketIntegration.sendNotificationToWorkspace(
      'workspace456',
      'announcement',
      'New Feature',
      'A new collaboration feature is now available!',
      'high'
    )
    
    // Get online users
    const onlineUsers = await socketIntegration.getUserPresence()
    console.log('Online users:', onlineUsers)
    
    // Update user status
    socketIntegration.updateUserStatus('online')
    
    // Request notification permission for urgent messages
    await socketIntegration.requestNotificationPermission()
  }
}

// Initialize when your app loads
initializeSocketIntegration()
*/