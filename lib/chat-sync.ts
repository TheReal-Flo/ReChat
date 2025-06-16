// Server-side imports - only available in Node.js environment
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

import type { Chat, Message } from '../types/chat'

// Conditional import for database service
let chatService: any, db: any
if (typeof window !== 'undefined') {
  // Client-side only
  const database = require('./database')
  chatService = database.chatService
  db = database.db
}

// Pool and Redis connections are initialized above conditionally

export interface SyncStatus {
  lastSyncTimestamp: Date
  pendingChanges: number
  isOnline: boolean
}

export class ChatSyncService {
  // Check if running on server
  private static isServer(): boolean {
    return typeof window === 'undefined'
  }

  // Upload local chats to server
  static async syncToServer(userId: string): Promise<void> {
    // This method should run on client side to access IndexedDB
    if (this.isServer()) {
      throw new Error('syncToServer must be called on the client side to access local database')
    }
    
    if (!chatService || !db) {
      throw new Error('Local database not available')
    }
    if (!userId) {
      throw new Error('User ID is required for syncing')
    }

    // Get all local chats from IndexedDB
    const localChats = await chatService.getAllChats()
    
    if (localChats.length === 0) {
      console.log('[SYNC] No local chats to upload')
      return
    }
    
    console.log(`[SYNC] Uploading ${localChats.length} local chats to server`)
    
    // Send chats to server via API
    const response = await fetch('/api/sync/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chats: localChats
      })
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to upload chats: ${error}`)
    }
    
    const result = await response.json()
    console.log('[SYNC] Upload completed:', result)
  }

  // Download server chats to local
  static async syncFromServer(userId: string): Promise<void> {
    // This method should run on client side to access IndexedDB
    if (this.isServer()) {
      throw new Error('syncFromServer must be called on the client side to access local database')
    }
    
    if (!chatService || !db) {
      throw new Error('Local database not available')
    }
    if (!userId) {
      throw new Error('User ID is required for syncing')
    }

    // Get server chats via API
    const response = await fetch('/api/sync/download', {
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
      return
    }
    
    console.log(`[SYNC] Downloading ${serverChats.length} chats from server`)
    
    for (const chat of serverChats) {
      // Check if chat exists locally
      const localChat = await chatService.getChatById(chat.id)
      
      if (!localChat) {
        // Create new local chat
        await this.createLocalChat(chat)
      } else {
        // Update local chat if server version is newer
        const serverTimestamp = new Date(chat.updatedAt)
        if (serverTimestamp > localChat.timestamp) {
          await this.updateLocalChat(chat)
        }
      }
    }
    
    console.log('[SYNC] Download completed')
  }

  // Create a new local chat from server data
  private static async createLocalChat(chat: Chat): Promise<void> {
    // Create chat directly with server data
    const chatWithMessages = {
      ...chat,
      messages: []
    }
    
    // Add chat to database with server ID
    await db.chats.add(chatWithMessages)

    // Add messages with server data preserved (ID, timestamp, position)
    for (const message of chat.messages) {
      const messageWithChatId = {
        ...message,
        chatId: chat.id
      }
      await db.messages.add(messageWithChatId)
    }
  }

  // Update local chat with server data
  private static async updateLocalChat(chat: Chat): Promise<void> {
    // Update chat metadata
    await chatService.updateChatTitle(chat.id, chat.title)
    await db.chats.update(chat.id, {
      timestamp: chat.timestamp,
      parentChatId: chat.parentChatId,
      branchFromMessageId: chat.branchFromMessageId,
      branches: chat.branches
    })

    // Get current local messages
    const localChat = await chatService.getChatById(chat.id)
    const localMessageIds = new Set(localChat?.messages.map((m: Message) => m.id) || [])

    // Add new messages from server
    for (const message of chat.messages) {
      if (!localMessageIds.has(message.id)) {
        const messageWithChatId = {
          ...message,
          chatId: chat.id
        }
        await db.messages.add(messageWithChatId)
      }
    }
  }

  // Update sync timestamp without performing full sync
  static async updateSyncTimestamp(userId: string): Promise<void> {
    if (!this.isServer()) {
      throw new Error('updateSyncTimestamp can only be called on the server side')
    }
    console.log('[SYNC DEBUG] Updating sync timestamp for user:', userId)
    
    try {
      const now = new Date()
      
      // Update Redis cache
      await redis.hset(`sync:${userId}`, {
        lastSync: now.getTime().toString(),
        updatedAt: now.getTime().toString()
      })
      
      // Update database
      const client = await pool.connect()
      try {
        await client.query(
          'INSERT INTO sync_status (user_id, last_sync_timestamp, created_at, updated_at) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id) DO UPDATE SET last_sync_timestamp = $2, updated_at = $4',
          [userId, now, now, now]
        )
        console.log('[SYNC DEBUG] Sync timestamp updated successfully')
      } finally {
        client.release()
      }
    } catch (error) {
      console.error('[SYNC DEBUG] Error updating sync timestamp:', error)
      throw error
    }
  }

  // Get sync status for a user
  static async getSyncStatus(userId: string): Promise<SyncStatus> {
    if (!this.isServer()) {
      throw new Error('getSyncStatus can only be called on the server side')
    }
    console.log('[SYNC DEBUG] Getting sync status for user:', userId)
    
    try {
      // Check Redis cache first
      console.log('[SYNC DEBUG] Checking Redis cache...')
      const cached = await redis.hgetall(`sync:${userId}`)
      console.log('[SYNC DEBUG] Redis cache result:', cached)
      
      if (cached.lastSync) {
        console.log('[SYNC DEBUG] Found cached sync data, returning online status')
        return {
          lastSyncTimestamp: new Date(parseInt(cached.lastSync)),
          pendingChanges: 0, // TODO: Implement pending changes detection
          isOnline: true
        }
      }

      // Fallback to database
      console.log('[SYNC DEBUG] No cache found, checking database...')
      const client = await pool.connect()
      try {
        const result = await client.query(
          'SELECT last_sync_timestamp FROM sync_status WHERE user_id = $1',
          [userId]
        )
        console.log('[SYNC DEBUG] Database query result:', result.rows)

        if (result.rows.length > 0) {
          console.log('[SYNC DEBUG] Found database sync record, returning online status')
          return {
            lastSyncTimestamp: new Date(result.rows[0].last_sync_timestamp),
            pendingChanges: 0,
            isOnline: true
          }
        }

        console.log('[SYNC DEBUG] No sync record found, creating initial sync record...')
         
         // Create initial sync record for new users
         const now = new Date()
         await client.query(
           'INSERT INTO sync_status (user_id, last_sync_timestamp, created_at, updated_at) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id) DO NOTHING',
           [userId, now, now, now]
         )
         
         // Also cache in Redis
         await redis.hset(`sync:${userId}`, {
           lastSync: now.getTime().toString(),
           updatedAt: now.getTime().toString()
         })
         
         console.log('[SYNC DEBUG] Created initial sync record, returning online status')
         return {
           lastSyncTimestamp: now,
           pendingChanges: 0,
           isOnline: true
         }
      } finally {
        client.release()
      }
    } catch (error) {
      console.error('[SYNC DEBUG] Error getting sync status:', error)
      return {
        lastSyncTimestamp: new Date(0),
        pendingChanges: 0,
        isOnline: false
      }
    }
  }

  // Perform full bidirectional sync
  static async performFullSync(userId: string): Promise<void> {
    try {
      // Check if user has local chats
      const localChats = await chatService.getAllChats()
      
      if (localChats.length === 0) {
        // New user or empty local storage - prioritize downloading from server
        console.log('[SYNC] No local chats found, downloading from server first')
        await this.syncFromServer(userId)
        await this.syncToServer(userId)
      } else {
        // Existing user - upload local changes first, then download
        console.log('[SYNC] Local chats found, uploading to server first')
        await this.syncToServer(userId)
        await this.syncFromServer(userId)
      }
      
      console.log(`Full sync completed for user: ${userId}`)
    } catch (error) {
      console.error('Sync failed:', error)
      throw error
    }
  }

  // Auto-sync on app startup
  static async autoSync(userId: string): Promise<void> {
    // This method can be called on both client and server
    // On client, it only handles local operations
    if (!this.isServer() && (!chatService || !db)) {
      console.warn('[SYNC] Client-side database not available for autoSync')
      return
    }
    if (!userId) {
      console.log('[SYNC DEBUG] No userId provided for auto-sync')
      return
    }

    try {
      console.log('[SYNC DEBUG] Starting auto-sync for user:', userId)
      
      // Test database connections
      await this.testConnections()
      
      const status = await this.getSyncStatus(userId)
      console.log('[SYNC DEBUG] Current sync status:', status)
      
      const now = new Date()
      const timeSinceLastSync = now.getTime() - status.lastSyncTimestamp.getTime()
      const tenSeconds = 10 * 1000 // Reduced to 10 seconds for better responsiveness

      console.log('[SYNC DEBUG] Time since last sync:', timeSinceLastSync, 'ms (threshold:', tenSeconds, 'ms)')

      // Only sync if it's been more than 10 seconds since last sync
      if (timeSinceLastSync > tenSeconds) {
        console.log('[SYNC DEBUG] Triggering full sync...')
        await this.performFullSync(userId)
        console.log('[SYNC DEBUG] Full sync completed successfully')
      } else {
        console.log('[SYNC DEBUG] Skipping sync - too recent')
      }
    } catch (error) {
      console.error('[SYNC DEBUG] Auto-sync failed:', error)
      // Don't throw error for auto-sync failures
    }
  }

  // Test database connections for debugging
  static async testConnections(): Promise<void> {
    try {
      // Test PostgreSQL connection
      const client = await pool.connect()
      console.log('[SYNC DEBUG] PostgreSQL connection: OK')
      client.release()
      
      // Test Redis connection
      await redis.ping()
      console.log('[SYNC DEBUG] Redis connection: OK')
    } catch (error) {
      console.error('[SYNC DEBUG] Database connection failed:', error)
      throw error
    }
  }
}

// Export the service
export const chatSync = ChatSyncService