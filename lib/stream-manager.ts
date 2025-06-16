import Redis from 'ioredis'
import { Message } from '../types/chat'

// Redis connection
const redis = new Redis()

export interface StreamState {
  streamId: string
  chatId: string
  messageId: string
  userId: string
  modelId: string
  messages: Message[]
  accumulatedContent: string
  status: 'streaming' | 'completed' | 'error' | 'cancelled'
  startTime: number
  lastActivity: number
  position: number
  apiKey?: string
}

export interface StreamStatus {
  exists: boolean
  status?: 'streaming' | 'completed' | 'error' | 'cancelled'
  content?: string
  position?: number
  lastActivity?: number
}

export class StreamManager {
  private static readonly STREAM_TTL = 3600 // 1 hour in seconds
  private static readonly CLEANUP_INTERVAL = 300000 // 5 minutes in milliseconds
  private static cleanupTimer: NodeJS.Timeout | null = null

  /**
   * Initialize a new resumable stream
   */
  static async startStream(
    chatId: string,
    messageId: string,
    userId: string,
    modelId: string,
    messages: Message[],
    apiKey?: string
  ): Promise<string> {
    const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const streamState: StreamState = {
      streamId,
      chatId,
      messageId,
      userId,
      modelId,
      messages,
      accumulatedContent: '',
      status: 'streaming',
      startTime: Date.now(),
      lastActivity: Date.now(),
      position: 0,
      apiKey
    }

    // Store stream state in Redis with TTL
    await redis.setex(
      `stream:${streamId}`,
      this.STREAM_TTL,
      JSON.stringify(streamState)
    )

    // Add to user's active streams set
    await redis.sadd(`user_streams:${userId}`, streamId)
    await redis.expire(`user_streams:${userId}`, this.STREAM_TTL)

    // Start cleanup timer if not already running
    this.startCleanupTimer()

    return streamId
  }

  /**
   * Get stream state from Redis
   */
  static async getStreamState(streamId: string): Promise<StreamState | null> {
    try {
      const data = await redis.get(`stream:${streamId}`)
      if (!data) return null
      
      return JSON.parse(data) as StreamState
    } catch (error) {
      console.error('Error getting stream state:', error)
      return null
    }
  }

  /**
   * Update stream content and position
   */
  static async updateStreamContent(
    streamId: string,
    newContent: string,
    position: number
  ): Promise<void> {
    try {
      const streamState = await this.getStreamState(streamId)
      if (!streamState) return

      streamState.accumulatedContent = newContent
      streamState.position = position
      streamState.lastActivity = Date.now()

      await redis.setex(
        `stream:${streamId}`,
        this.STREAM_TTL,
        JSON.stringify(streamState)
      )
    } catch (error) {
      console.error('Error updating stream content:', error)
    }
  }

  /**
   * Mark stream as completed
   */
  static async completeStream(streamId: string): Promise<void> {
    try {
      const streamState = await this.getStreamState(streamId)
      if (!streamState) return

      streamState.status = 'completed'
      streamState.lastActivity = Date.now()

      await redis.setex(
        `stream:${streamId}`,
        this.STREAM_TTL,
        JSON.stringify(streamState)
      )
    } catch (error) {
      console.error('Error completing stream:', error)
    }
  }

  /**
   * Mark stream as error
   */
  static async errorStream(streamId: string, error: string): Promise<void> {
    try {
      const streamState = await this.getStreamState(streamId)
      if (!streamState) return

      streamState.status = 'error'
      streamState.lastActivity = Date.now()
      streamState.accumulatedContent += `\n\nError: ${error}`

      await redis.setex(
        `stream:${streamId}`,
        this.STREAM_TTL,
        JSON.stringify(streamState)
      )
    } catch (error) {
      console.error('Error setting stream error:', error)
    }
  }

  /**
   * Cancel a stream
   */
  static async cancelStream(streamId: string): Promise<void> {
    try {
      const streamState = await this.getStreamState(streamId)
      if (!streamState) return

      streamState.status = 'cancelled'
      streamState.lastActivity = Date.now()

      await redis.setex(
        `stream:${streamId}`,
        this.STREAM_TTL,
        JSON.stringify(streamState)
      )

      // Remove from user's active streams
      await redis.srem(`user_streams:${streamState.userId}`, streamId)
    } catch (error) {
      console.error('Error cancelling stream:', error)
    }
  }

  /**
   * Get stream status for client
   */
  static async getStreamStatus(streamId: string): Promise<StreamStatus> {
    try {
      const streamState = await this.getStreamState(streamId)
      if (!streamState) {
        return { exists: false }
      }

      return {
        exists: true,
        status: streamState.status,
        content: streamState.accumulatedContent,
        position: streamState.position,
        lastActivity: streamState.lastActivity
      }
    } catch (error) {
      console.error('Error getting stream status:', error)
      return { exists: false }
    }
  }

  /**
   * Get all active streams for a user
   */
  static async getUserActiveStreams(userId: string): Promise<string[]> {
    try {
      return await redis.smembers(`user_streams:${userId}`)
    } catch (error) {
      console.error('Error getting user active streams:', error)
      return []
    }
  }

  /**
   * Cleanup expired streams
   */
  static async cleanupExpiredStreams(): Promise<void> {
    try {
      const pattern = 'stream:*'
      const keys = await redis.keys(pattern)
      const now = Date.now()
      const expiredThreshold = now - (this.STREAM_TTL * 1000) // Convert to milliseconds

      for (const key of keys) {
        try {
          const data = await redis.get(key)
          if (!data) continue

          const streamState = JSON.parse(data) as StreamState
          if (streamState.lastActivity < expiredThreshold) {
            // Remove expired stream
            await redis.del(key)
            await redis.srem(`user_streams:${streamState.userId}`, streamState.streamId)
            console.log(`Cleaned up expired stream: ${streamState.streamId}`)
          }
        } catch (parseError) {
          // Remove corrupted data
          await redis.del(key)
        }
      }
    } catch (error) {
      console.error('Error during stream cleanup:', error)
    }
  }

  /**
   * Start periodic cleanup timer
   */
  private static startCleanupTimer(): void {
    if (this.cleanupTimer) return

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredStreams()
    }, this.CLEANUP_INTERVAL)
  }

  /**
   * Stop cleanup timer
   */
  static stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  /**
   * Validate stream ownership
   */
  static async validateStreamOwnership(streamId: string, userId: string): Promise<boolean> {
    try {
      const streamState = await this.getStreamState(streamId)
      return streamState?.userId === userId
    } catch (error) {
      console.error('Error validating stream ownership:', error)
      return false
    }
  }
}