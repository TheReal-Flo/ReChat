import type { Chat, Message, SyncSettings, SyncStatus } from '../types/chat'

// Conditional imports for server-side only
let Pool: any, Redis: any, pool: any, redis: any

if (typeof window === 'undefined') {
  // Server-side only
  const pg = require('pg')
  const ioredis = require('ioredis')
  Pool = pg.Pool
  Redis = ioredis.default || ioredis
  
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })
  
  redis = new Redis(process.env.REDIS_URL, {
    password: process.env.REDIS_PASSWORD,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
  })
} else {
  // Client-side fallback
  console.warn('[SYNC] Server-side modules not available on client')
}

// Conditional import for database service
let chatService: any, db: any
if (typeof window !== 'undefined') {
  // Client-side only
  const database = require('./database')
  chatService = database.chatService
  db = database.db
}

export class ChatSyncService {
  private static syncInterval: NodeJS.Timeout | null = null
  private static isInitialized = false
  private static pendingUploads = new Set<string>()
  private static lastSyncTime = 0
  private static syncDebounceMs = 1000 // Minimum time between syncs

  // Check if running on server
  private static isServer(): boolean {
    return typeof window === 'undefined'
  }

  // Get sync settings from localStorage
  static getSyncSettings(): SyncSettings {
    if (this.isServer()) {
      return { enabled: false, autoUpload: false, downloadInterval: 30 }
    }
    
    const settings = localStorage.getItem('sync_settings')
    if (settings) {
      try {
        return JSON.parse(settings)
      } catch (e) {
        console.warn('[SYNC] Failed to parse sync settings, using defaults')
      }
    }
    
    // Default settings
    return {
      enabled: false, // Opt-in by default
      autoUpload: true,
      downloadInterval: 30 // seconds
    }
  }

  // Save sync settings to localStorage
  static setSyncSettings(settings: SyncSettings): void {
    if (this.isServer()) return
    
    localStorage.setItem('sync_settings', JSON.stringify(settings))
    
    // Restart sync with new settings
    if (settings.enabled) {
      this.startAutoSync()
    } else {
      this.stopAutoSync()
    }
  }

  // Initialize sync system
  static async initialize(userId?: string): Promise<void> {
    if (this.isServer() || this.isInitialized) return
    
    const settings = this.getSyncSettings()
    if (!settings.enabled || !userId) {
      console.log('[SYNC] Sync disabled or no user ID')
      return
    }
    
    this.isInitialized = true
    console.log('[SYNC] Initializing sync system')
    
    // Start auto-sync
    this.startAutoSync(userId)
  }

  // Start automatic sync
  static startAutoSync(userId?: string): void {
    if (this.isServer()) return
    
    const settings = this.getSyncSettings()
    if (!settings.enabled) return
    
    // Clear existing interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }
    
    // Start periodic downloads
    this.syncInterval = setInterval(async () => {
      if (userId) {
        try {
          await this.downloadFromServer(userId)
          // Trigger UI refresh after successful sync
          this.notifyUIRefresh()
        } catch (error) {
          console.error('[SYNC] Auto-download failed:', error)
        }
      }
    }, settings.downloadInterval * 1000)
    
    console.log(`[SYNC] Auto-sync started with ${settings.downloadInterval}s interval`)
  }

  // Stop automatic sync
  static stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
      console.log('[SYNC] Auto-sync stopped')
    }
  }

  // Notify UI to refresh after sync
  private static notifyUIRefresh(): void {
    // Dispatch custom event to notify UI components
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('chatSyncComplete', {
        detail: { timestamp: new Date() }
      })
      window.dispatchEvent(event)
      console.log('[SYNC] UI refresh event dispatched')
    }
  }

  // Upload changes after message (called after every message)
  static async uploadAfterMessage(chatId: string, userId: string): Promise<void> {
    if (this.isServer()) return
    
    const settings = this.getSyncSettings()
    if (!settings.enabled || !settings.autoUpload) return
    
    // Debounce rapid sync operations
    const now = Date.now()
    if (now - this.lastSyncTime < this.syncDebounceMs) {
      console.log(`[SYNC] Debouncing sync for chat ${chatId}`)
      return
    }
    this.lastSyncTime = now
    
    // Prevent duplicate uploads for the same chat
    if (this.pendingUploads.has(chatId)) {
      console.log(`[SYNC] Upload already pending for chat ${chatId}`)
      return
    }
    
    this.pendingUploads.add(chatId)
    
    try {
      await this.uploadChatToServer(chatId, userId)
      console.log(`[SYNC] Successfully uploaded chat ${chatId}`)
    } catch (error) {
      console.error(`[SYNC] Failed to upload chat ${chatId}:`, error)
    } finally {
      this.pendingUploads.delete(chatId)
    }
  }

  // Upload a specific chat to server
  static async uploadChatToServer(chatId: string, userId: string): Promise<void> {
    if (this.isServer() || !chatService || !db) {
      throw new Error('uploadChatToServer must be called on the client side')
    }
    
    const localChat = await chatService.getChatById(chatId)
    if (!localChat) {
      throw new Error(`Chat ${chatId} not found locally`)
    }
    
    const response = await fetch('/api/sync/upload-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat: localChat,
        userId
      })
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to upload chat: ${error}`)
    }
    
    // Update lastSyncedAt timestamp
    const now = new Date()
    await db.chats.update(chatId, { lastSyncedAt: now })
  }

  // Download changes from server
  static async downloadFromServer(userId: string): Promise<boolean> {
    if (this.isServer() || !chatService || !db) {
      throw new Error('downloadFromServer must be called on the client side')
    }
    
    const response = await fetch(`/api/sync/download?userId=${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to download chats: ${error}`)
    }
    
    const { chats: serverChats } = await response.json()
    
    if (!serverChats || serverChats.length === 0) {
      console.log('[SYNC] No server chats to download')
      return false
    }
    
    console.log(`[SYNC] Processing ${serverChats.length} chats from server`)
    
    let hasChanges = false
    for (const serverChat of serverChats) {
      const changed = await this.mergeServerChat(serverChat)
      if (changed) hasChanges = true
    }
    
    console.log('[SYNC] Download completed')
    return hasChanges
  }

  // Merge server chat with local chat (local-first approach)
  private static async mergeServerChat(serverChat: Chat): Promise<boolean> {
    try {
      const localChat = await chatService.getChatById(serverChat.id)
      
      if (!localChat) {
        // No local version, create from server data
        await this.createLocalChatFromServer(serverChat)
        return true
      }
      
      // Local-first: Compare timestamps to determine which version is newer
      const localUpdated = new Date(localChat.updatedAt)
      const serverUpdated = new Date(serverChat.updatedAt)
      
      if (localUpdated > serverUpdated) {
        // Local is newer, upload to server
        console.log(`[SYNC] Local chat ${serverChat.id} is newer, will upload on next sync`)
        return false
      }
      
      if (serverUpdated > localUpdated) {
        // Server is newer, update local
        console.log(`[SYNC] Server chat ${serverChat.id} is newer, updating local`)
        await this.updateLocalChatFromServer(serverChat)
        return true
      }
      
      // Same timestamp, check if we need to sync messages
      return await this.mergeMessages(serverChat)
    } catch (error) {
      console.error(`[SYNC] Error merging chat ${serverChat.id}:`, error)
      // Don't throw to prevent breaking the entire sync process
      return false
    }
  }

  // Create local chat from server data
  private static async createLocalChatFromServer(serverChat: Chat): Promise<void> {
    console.log(`[SYNC] Creating local chat ${serverChat.id} from server`)
    
    try {
      await db.transaction('rw', db.chats, db.messages, async () => {
        // Create chat without messages first
        const chatWithoutMessages = {
          ...serverChat,
          messages: [],
          lastSyncedAt: new Date()
        }
        
        await db.chats.add(chatWithoutMessages)
        
        // Add messages
        for (const message of serverChat.messages) {
          const messageWithChatId = {
            ...message,
            chatId: serverChat.id,
            timestamp: new Date(message.timestamp),
            createdAt: new Date(message.createdAt),
            updatedAt: new Date(message.updatedAt)
          }
          await db.messages.add(messageWithChatId)
        }
      })
      console.log(`[SYNC] Successfully created local chat ${serverChat.id}`)
    } catch (error) {
      console.error(`[SYNC] Error creating local chat ${serverChat.id}:`, error)
      throw error
    }
  }

  // Update local chat from server data
  private static async updateLocalChatFromServer(serverChat: Chat): Promise<boolean> {
    console.log(`[SYNC] Updating local chat ${serverChat.id} from server`)
    
    // Update chat metadata
    await db.chats.update(serverChat.id, {
      title: serverChat.title,
      timestamp: new Date(serverChat.timestamp),
      parentChatId: serverChat.parentChatId,
      branchFromMessageId: serverChat.branchFromMessageId,
      branches: serverChat.branches,
      updatedAt: new Date(serverChat.updatedAt),
      lastSyncedAt: new Date()
    })
    
    // Merge messages
    const messagesChanged = await this.mergeMessages(serverChat)
    
    // Chat metadata was updated, so return true if messages changed or always true for chat update
    return true || messagesChanged
  }

  // Merge messages between local and server
  private static async mergeMessages(serverChat: Chat): Promise<boolean> {
    let hasChanges = false
    try {
      await db.transaction('rw', db.messages, async () => {
        const localMessages = await db.messages.where('chatId').equals(serverChat.id).toArray()
        // @ts-ignore wrong type allocation
        const localMessageMap = new Map(localMessages.map(m => [m.id, m]))
        
        for (const serverMessage of serverChat.messages) {
          try {
            const localMessage: Message = localMessageMap.get(serverMessage.id) as Message
            
            if (!localMessage) {
              // New message from server
              const messageWithChatId = {
                ...serverMessage,
                chatId: serverChat.id,
                timestamp: new Date(serverMessage.timestamp),
                createdAt: new Date(serverMessage.createdAt),
                updatedAt: new Date(serverMessage.updatedAt)
              }
              await db.messages.add(messageWithChatId)
              console.log(`[SYNC] Added new message ${serverMessage.id} from server`)
              hasChanges = true
            } else {
              // Check if server message is newer
              const localUpdated = new Date(localMessage.updatedAt)
              const serverUpdated = new Date(serverMessage.updatedAt)
              
              if (serverUpdated > localUpdated) {
                // Update local message with server data
                await db.messages.update(serverMessage.id, {
                  content: serverMessage.content,
                  attachments: serverMessage.attachments,
                  position: serverMessage.position,
                  updatedAt: new Date(serverMessage.updatedAt)
                })
                console.log(`[SYNC] Updated message ${serverMessage.id} from server`)
                hasChanges = true
              }
            }
          } catch (messageError) {
            console.error(`[SYNC] Error processing message ${serverMessage.id}:`, messageError)
            // Continue with other messages
          }
        }
      })
    } catch (error) {
      console.error(`[SYNC] Error merging messages for chat ${serverChat.id}:`, error)
      throw error
    }
    return hasChanges
  }

  // Get sync status
  static async getSyncStatus(userId: string): Promise<SyncStatus> {
    const settings = this.getSyncSettings()
    
    if (this.isServer()) {
      // Server-side status check
      try {
        const client = await pool.connect()
        try {
          const result = await client.query(
            'SELECT last_sync_timestamp FROM sync_status WHERE user_id = $1',
            [userId]
          )
          
          const lastSync = result.rows.length > 0 
            ? new Date(result.rows[0].last_sync_timestamp)
            : new Date(0)
          
          return {
            lastSyncTimestamp: lastSync,
            pendingChanges: 0,
            isOnline: true,
            syncEnabled: settings.enabled
          }
        } finally {
          client.release()
        }
      } catch (error) {
        console.error('[SYNC] Error getting server sync status:', error)
        return {
          lastSyncTimestamp: new Date(0),
          pendingChanges: 0,
          isOnline: false,
          syncEnabled: settings.enabled
        }
      }
    } else {
      // Client-side status
      let pendingChanges = 0
      
      if (chatService && db) {
        try {
          // Count chats that haven't been synced or have been updated since last sync
          const allChats = await chatService.getAllChats()
          pendingChanges = allChats.filter((chat: Chat) => {
            if (!chat.lastSyncedAt) return true
            return new Date(chat.updatedAt) > new Date(chat.lastSyncedAt)
          }).length
        } catch (error) {
          console.error('[SYNC] Error counting pending changes:', error)
        }
      }
      
      return {
        lastSyncTimestamp: new Date(), // TODO: Track last successful sync
        pendingChanges,
        isOnline: navigator.onLine,
        syncEnabled: settings.enabled
      }
    }
  }

  // Manual full sync
  static async performFullSync(userId: string): Promise<void> {
    if (this.isServer()) {
      throw new Error('performFullSync must be called on the client side')
    }
    
    const settings = this.getSyncSettings()
    if (!settings.enabled) {
      throw new Error('Sync is disabled')
    }
    
    console.log('[SYNC] Starting full sync')
    
    try {
      // First download from server to get latest changes
      await this.downloadFromServer(userId)
      
      // Then upload any local changes
      if (settings.autoUpload) {
        await this.uploadAllChats(userId)
      }
      
      console.log('[SYNC] Full sync completed')
    } catch (error) {
      console.error('[SYNC] Full sync failed:', error)
      throw error
    }
  }

  // Upload all local chats
  private static async uploadAllChats(userId: string): Promise<void> {
    if (!chatService) return
    
    const allChats = await chatService.getAllChats()
    const chatsToUpload = allChats.filter((chat: Chat) => {
      if (!chat.lastSyncedAt) return true
      return new Date(chat.updatedAt) > new Date(chat.lastSyncedAt)
    })
    
    console.log(`[SYNC] Uploading ${chatsToUpload.length} modified chats`)
    
    for (const chat of chatsToUpload) {
      try {
        await this.uploadChatToServer(chat.id, userId)
      } catch (error) {
        console.error(`[SYNC] Failed to upload chat ${chat.id}:`, error)
      }
    }
  }

  // Update sync timestamp on server
  static async updateSyncTimestamp(userId: string): Promise<void> {
    if (!this.isServer()) {
      console.warn('[SYNC] updateSyncTimestamp should only be called on server')
      return
    }

    try {
      const now = new Date().toISOString()
      
      // Update Redis cache
      if (redis) {
        await redis.set(`sync:timestamp:${userId}`, now)
        console.log(`[SYNC] Updated sync timestamp for user ${userId}`)
      }
    } catch (error) {
      console.error('[SYNC] Failed to update sync timestamp:', error)
      throw error
    }
  }

  // Delete chat from server
  static async deleteChatFromServer(chatId: string): Promise<void> {
    if (this.isServer()) return
    
    try {
      const response = await fetch(`/api/sync/delete-chat?chatId=${encodeURIComponent(chatId)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(`Failed to delete chat from server: ${errorData.error || response.statusText}`)
      }

      const result = await response.json()
      console.log('Chat deleted from server:', result)
    } catch (error) {
      console.error('Error deleting chat from server:', error)
      throw error
    }
  }

  // Cleanup method
  static cleanup(): void {
    this.stopAutoSync()
    this.pendingUploads.clear()
    this.isInitialized = false
  }
}

// Export the service
export const chatSync = ChatSyncService