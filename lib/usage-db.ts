import { Pool } from 'pg'
import Redis from 'ioredis'

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

// Redis connection
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

// Premium models (Claude models and image generation)
const PREMIUM_MODELS = [
  "claude-3.5-sonnet",
  "claude-3-haiku",
  "claude-3-opus",
  "claude-3.7-sonnet",
  "claude-sonnet-4",
  "claude-opus-4",
  'gpt-image-1'
]

// Default usage limits (can be overridden per user)
const DEFAULT_USAGE_LIMITS = {
  TOTAL_MESSAGES: 100,
  PREMIUM_MESSAGES: 2
}

// Time windows (in seconds)
const TIME_WINDOWS = {
  DAILY: 24 * 60 * 60, // 24 hours
  MONTHLY: 30 * 24 * 60 * 60 // 30 days
}

export interface UsageStats {
  userId: string
  totalMessages: number
  premiumMessages: number
  lastReset: Date
  canSendMessage: boolean
  canSendPremiumMessage: boolean
}

export class UsageTracker {
  // Get user-specific limits or default limits
  static async getUserLimits(userId: string): Promise<{ totalLimit: number; premiumLimit: number }> {
    const client = await pool.connect()
    try {
      const result = await client.query(`
        SELECT total_messages_limit, premium_messages_limit
        FROM user_limits 
        WHERE user_id = $1
      `, [userId])
      
      if (result.rows.length === 0) {
        return {
          totalLimit: DEFAULT_USAGE_LIMITS.TOTAL_MESSAGES,
          premiumLimit: DEFAULT_USAGE_LIMITS.PREMIUM_MESSAGES
        }
      }
      
      const row = result.rows[0]
      return {
        totalLimit: row.total_messages_limit,
        premiumLimit: row.premium_messages_limit
      }
    } finally {
      client.release()
    }
  }

  // Set user-specific limits (admin function)
  static async setUserLimits(userId: string, totalLimit: number, premiumLimit: number): Promise<void> {
    const client = await pool.connect()
    try {
      await client.query(`
        INSERT INTO user_limits (user_id, total_messages_limit, premium_messages_limit, updated_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          total_messages_limit = $2,
          premium_messages_limit = $3,
          updated_at = CURRENT_TIMESTAMP
      `, [userId, totalLimit, premiumLimit])
    } finally {
      client.release()
    }
  }

  // Initialize database tables
  static async initializeDatabase() {
    const client = await pool.connect()
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_usage (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) UNIQUE NOT NULL,
          total_messages INTEGER DEFAULT 0,
          premium_messages INTEGER DEFAULT 0,
          last_reset TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS user_limits (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) UNIQUE NOT NULL,
          total_messages_limit INTEGER DEFAULT 100,
          premium_messages_limit INTEGER DEFAULT 20,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON user_usage(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_limits_user_id ON user_limits(user_id);
        
        CREATE TABLE IF NOT EXISTS message_logs (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          model_id VARCHAR(255) NOT NULL,
          is_premium BOOLEAN DEFAULT FALSE,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS user_memories (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) UNIQUE NOT NULL,
          memory_content TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_message_logs_user_timestamp ON message_logs(user_id, timestamp);
        
        -- Chat sync tables
        CREATE TABLE IF NOT EXISTS chats (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          title VARCHAR(500) NOT NULL,
          timestamp TIMESTAMP NOT NULL,
          parent_chat_id VARCHAR(255),
          branch_from_message_id VARCHAR(255),
          branches TEXT[], -- Array of child chat IDs
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_deleted BOOLEAN DEFAULT FALSE
        );
        
        CREATE TABLE IF NOT EXISTS messages (
          id VARCHAR(255) PRIMARY KEY,
          chat_id VARCHAR(255) NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
          timestamp TIMESTAMP NOT NULL,
          position INTEGER,
          attachments JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_deleted BOOLEAN DEFAULT FALSE,
          FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
        );
        
        CREATE TABLE IF NOT EXISTS sync_status (
          user_id VARCHAR(255) PRIMARY KEY,
          last_sync_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          device_id VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
        CREATE INDEX IF NOT EXISTS idx_chats_timestamp ON chats(user_id, timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
        CREATE INDEX IF NOT EXISTS idx_messages_user_timestamp ON messages(user_id, timestamp);
        CREATE INDEX IF NOT EXISTS idx_messages_position ON messages(chat_id, position);
      `)
    } finally {
      client.release()
    }
  }

  // Check if user can send a message
  static async checkUsageLimit(userId: string, modelId: string): Promise<{ canSend: boolean; reason?: string }> {
    const isPremium = PREMIUM_MODELS.includes(modelId)
    
    // Get user-specific limits
    const limits = await this.getUserLimits(userId)
    
    // Get current usage from Redis (fast cache)
    const redisKey = `usage:${userId}:monthly`
    const cached = await redis.hmget(redisKey, 'total', 'premium', 'timestamp')
    
    let totalMessages = 0
    let premiumMessages = 0
    let lastUpdate = 0
    
    if (cached[0] && cached[1] && cached[2]) {
      totalMessages = parseInt(cached[0])
      premiumMessages = parseInt(cached[1])
      lastUpdate = parseInt(cached[2])
    }
    
    // Check if cache is stale (older than 1 hour) or doesn't exist
    const now = Date.now()
    const oneHour = 60 * 60 * 1000
    
    if (!cached[0] || (now - lastUpdate) > oneHour) {
      // Refresh from database
      const dbStats = await this.getUserUsageFromDB(userId)
      totalMessages = dbStats.totalMessages
      premiumMessages = dbStats.premiumMessages
      
      // Update Redis cache
      await redis.hmset(redisKey, {
        total: totalMessages.toString(),
        premium: premiumMessages.toString(),
        timestamp: now.toString()
      })
      await redis.expire(redisKey, TIME_WINDOWS.MONTHLY)
    }
    
    // Check limits using user-specific limits
    if (totalMessages >= limits.totalLimit) {
      return { 
        canSend: false, 
        reason: `You have reached your monthly limit of ${limits.totalLimit} messages. Your usage will reset at the beginning of next month. To continue chatting, you can either wait for the reset or upgrade your plan for higher limits.` 
      }
    }

    if (isPremium && premiumMessages >= limits.premiumLimit) {
      return { 
        canSend: false, 
        reason: `You have reached your monthly limit of ${limits.premiumLimit} premium model messages. Your usage will reset at the beginning of next month. You can still use standard models or upgrade your plan for higher premium limits.` 
      }
    }
    
    return { canSend: true }
  }

  // Record usage for a user
  static async recordUsage(userId: string, modelId: string, usingCustomKey: boolean = false): Promise<void> {
    // Skip usage tracking if user is using their own API key
    if (usingCustomKey) {
      console.log(`[USAGE] Skipping usage tracking for user ${userId} - using custom API key`)
      return
    }
    
    const isPremium = PREMIUM_MODELS.includes(modelId)
    
    // Update database
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      
      // Insert or update user usage
      // Premium messages only count as premium, not as total messages
      const totalIncrement = isPremium ? 0 : 1
      const premiumIncrement = isPremium ? 1 : 0
      
      await client.query(`
        INSERT INTO user_usage (user_id, total_messages, premium_messages, last_reset, updated_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          total_messages = CASE 
            WHEN user_usage.last_reset < DATE_TRUNC('month', CURRENT_DATE) THEN $2
            ELSE user_usage.total_messages + $2
          END,
          premium_messages = CASE 
            WHEN user_usage.last_reset < DATE_TRUNC('month', CURRENT_DATE) THEN $3
            ELSE user_usage.premium_messages + $3
          END,
          last_reset = CASE 
            WHEN user_usage.last_reset < DATE_TRUNC('month', CURRENT_DATE) THEN CURRENT_TIMESTAMP
            ELSE user_usage.last_reset
          END,
          updated_at = CURRENT_TIMESTAMP
      `, [userId, totalIncrement, premiumIncrement])
      
      // Log the message
      await client.query(`
        INSERT INTO message_logs (user_id, model_id, is_premium)
        VALUES ($1, $2, $3)
      `, [userId, modelId, isPremium])
      
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
    
    // Update Redis cache
    const redisKey = `usage:${userId}:monthly`
    const pipe = redis.pipeline()
    
    // Premium messages only count as premium, not as total
    if (isPremium) {
      pipe.hincrby(redisKey, 'premium', 1)
    } else {
      pipe.hincrby(redisKey, 'total', 1)
    }
    
    pipe.hset(redisKey, 'timestamp', Date.now().toString())
    pipe.expire(redisKey, TIME_WINDOWS.MONTHLY)
    await pipe.exec()
  }

  // Memory management methods
  static async getUserMemory(userId: string): Promise<string | null> {
    const client = await pool.connect()
    try {
      const result = await client.query(`
        SELECT memory_content FROM user_memories
        WHERE user_id = $1
      `, [userId])
      
      return result.rows.length > 0 ? result.rows[0].memory_content : null
    } catch (error) {
      console.error('Error getting user memory:', error)
      return null
    } finally {
      client.release()
    }
  }
  
  static async setUserMemory(userId: string, memoryContent: string): Promise<boolean> {
    const client = await pool.connect()
    try {
      await client.query(`
        INSERT INTO user_memories (user_id, memory_content, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          memory_content = $2,
          updated_at = CURRENT_TIMESTAMP
      `, [userId, memoryContent])
      
      return true
    } catch (error) {
      console.error('Error setting user memory:', error)
      return false
    } finally {
      client.release()
    }
  }
  
  // Get user usage stats from database
  static async getUserUsageFromDB(userId: string): Promise<UsageStats> {
    const client = await pool.connect()
    try {
      // Get user limits
      const limits = await this.getUserLimits(userId)
      
      const result = await client.query(`
        SELECT 
          user_id,
          CASE 
            WHEN last_reset < DATE_TRUNC('month', CURRENT_DATE) THEN 0
            ELSE total_messages
          END as total_messages,
          CASE 
            WHEN last_reset < DATE_TRUNC('month', CURRENT_DATE) THEN 0
            ELSE premium_messages
          END as premium_messages,
          last_reset
        FROM user_usage 
        WHERE user_id = $1
      `, [userId])
      
      if (result.rows.length === 0) {
        return {
          userId,
          totalMessages: 0,
          premiumMessages: 0,
          lastReset: new Date(),
          canSendMessage: true,
          canSendPremiumMessage: true
        }
      }
      
      const row = result.rows[0]
      return {
        userId: row.user_id,
        totalMessages: row.total_messages,
        premiumMessages: row.premium_messages,
        lastReset: row.last_reset,
        canSendMessage: row.total_messages < limits.totalLimit,
        canSendPremiumMessage: row.premium_messages < limits.premiumLimit
      }
    } finally {
      client.release()
    }
  }

  // Get user usage stats (with caching)
  static async getUserUsage(userId: string): Promise<UsageStats> {
    const redisKey = `usage:${userId}:monthly`
    const cached = await redis.hmget(redisKey, 'total', 'premium', 'timestamp')
    
    if (cached[0] && cached[1] && cached[2]) {
      const totalMessages = parseInt(cached[0])
      const premiumMessages = parseInt(cached[1])
      
      // Get user limits for accurate canSend flags
      const limits = await this.getUserLimits(userId)
      
      return {
        userId,
        totalMessages,
        premiumMessages,
        lastReset: new Date(),
        canSendMessage: totalMessages < limits.totalLimit,
        canSendPremiumMessage: premiumMessages < limits.premiumLimit
      }
    }
    
    // Fallback to database
    return this.getUserUsageFromDB(userId)
  }

  // Reset user usage (admin function)
  static async resetUserUsage(userId: string): Promise<void> {
    const client = await pool.connect()
    try {
      await client.query(`
        UPDATE user_usage 
        SET total_messages = 0, premium_messages = 0, last_reset = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
      `, [userId])
    } finally {
      client.release()
    }
    
    // Clear Redis cache
    const redisKey = `usage:${userId}:monthly`
    await redis.del(redisKey)
  }

  // Get usage analytics (admin function)
  static async getUsageAnalytics(days: number = 7) {
    const client = await pool.connect()
    try {
      const result = await client.query(`
        SELECT 
          DATE(timestamp) as date,
          COUNT(*) as total_messages,
          COUNT(*) FILTER (WHERE is_premium = true) as premium_messages,
          COUNT(DISTINCT user_id) as active_users
        FROM message_logs 
        WHERE timestamp >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY DATE(timestamp)
        ORDER BY date DESC
      `)
      
      return result.rows
    } finally {
      client.release()
    }
  }
}

// Initialize database on module load
UsageTracker.initializeDatabase().catch(console.error)

export { PREMIUM_MODELS, DEFAULT_USAGE_LIMITS }