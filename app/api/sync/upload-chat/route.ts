import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { Pool } from 'pg'
import Redis from 'ioredis'
import type { Chat } from '../../../../types/chat'

// Server-side database connections
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const redis = new Redis()

// POST: Upload a single chat to server (local-first approach)
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { chat } = await req.json()
    
    if (!chat) {
      return NextResponse.json(
        { error: 'Chat data is required' },
        { status: 400 }
      )
    }

    const client = await pool.connect()
    
    try {
      await client.query('BEGIN')

      // Check if chat exists on server
      const existingChat = await client.query(
        'SELECT id, updated_at FROM chats WHERE id = $1 AND user_id = $2',
        [chat.id, userId]
      )

      const now = new Date()
      const localUpdatedAt = new Date(chat.updatedAt)

      if (existingChat.rows.length === 0) {
        // Insert new chat
        await client.query(`
          INSERT INTO chats (
            id, user_id, title, timestamp, parent_chat_id, 
            branch_from_message_id, branches, created_at, updated_at, is_deleted
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          chat.id,
          userId,
          chat.title,
          chat.timestamp,
          chat.parentChatId || null,
          chat.branchFromMessageId || null,
          chat.branches || [],
          chat.createdAt,
          chat.updatedAt,
          false
        ])
        
        console.log(`[SYNC UPLOAD] Created new chat ${chat.id}`)
      } else {
        // Local-first: Only update if local version is newer
        const serverUpdatedAt = new Date(existingChat.rows[0].updated_at)
        
        if (localUpdatedAt > serverUpdatedAt) {
          // Update existing chat with local data
          await client.query(`
            UPDATE chats SET 
              title = $3, timestamp = $4, parent_chat_id = $5,
              branch_from_message_id = $6, branches = $7, updated_at = $8
            WHERE id = $1 AND user_id = $2
          `, [
            chat.id,
            userId,
            chat.title,
            chat.timestamp,
            chat.parentChatId || null,
            chat.branchFromMessageId || null,
            chat.branches || [],
            chat.updatedAt
          ])
          
          console.log(`[SYNC UPLOAD] Updated chat ${chat.id} (local newer)`)
        } else {
          console.log(`[SYNC UPLOAD] Skipped chat ${chat.id} (server newer or same)`)
        }
      }

      // Handle messages
      for (const message of chat.messages) {
        const existingMessage = await client.query(
          'SELECT id, updated_at FROM messages WHERE id = $1 AND user_id = $2',
          [message.id, userId]
        )

        const messageUpdatedAt = new Date(message.updatedAt)

        if (existingMessage.rows.length === 0) {
          // Insert new message
          await client.query(`
            INSERT INTO messages (
              id, chat_id, user_id, content, role, timestamp, 
              attachments, position, created_at, updated_at, is_deleted
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `, [
            message.id,
            chat.id,
            userId,
            message.content,
            message.role,
            message.timestamp,
            message.attachments ? JSON.stringify(message.attachments) : null,
            message.position || 0,
            message.createdAt,
            message.updatedAt,
            false
          ])
        } else {
          // Local-first: Only update if local version is newer
          const serverMessageUpdatedAt = new Date(existingMessage.rows[0].updated_at)
          
          if (messageUpdatedAt > serverMessageUpdatedAt) {
            await client.query(`
              UPDATE messages SET 
                content = $3, role = $4, timestamp = $5, 
                attachments = $6, position = $7, updated_at = $8
              WHERE id = $1 AND user_id = $2
            `, [
              message.id,
              userId,
              message.content,
              message.role,
              message.timestamp,
              message.attachments ? JSON.stringify(message.attachments) : null,
              message.position || 0,
              message.updatedAt
            ])
          }
        }
      }

      // Update sync status
      await client.query(
        'INSERT INTO sync_status (user_id, last_sync_timestamp, created_at, updated_at) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id) DO UPDATE SET last_sync_timestamp = $2, updated_at = $4',
        [userId, now, now, now]
      )

      // Update Redis cache
      await redis.hset(`sync:${userId}`, {
        lastSync: now.getTime().toString(),
        updatedAt: now.getTime().toString()
      })

      await client.query('COMMIT')

      console.log(`[SYNC UPLOAD] Successfully processed chat ${chat.id} for user ${userId}`)

      return NextResponse.json({
        success: true,
        chatId: chat.id,
        messagesCount: chat.messages.length
      })

    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error: any) {
    console.error('Error uploading chat:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload chat' },
      { status: 500 }
    )
  }
}