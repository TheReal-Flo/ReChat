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

// POST: Upload local chats to server
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { chats } = await req.json()
    
    if (!chats || !Array.isArray(chats)) {
      return NextResponse.json(
        { error: 'Invalid chats data' },
        { status: 400 }
      )
    }

    const client = await pool.connect()
    let uploadedChats = 0
    let uploadedMessages = 0
    
    try {
      await client.query('BEGIN')

      for (const chat of chats) {
        // Check if chat exists on server
        const existingChat = await client.query(
          'SELECT id, updated_at FROM chats WHERE id = $1 AND user_id = $2',
          [chat.id, userId]
        )

        if (existingChat.rows.length === 0) {
          // Insert new chat
          await client.query(`
            INSERT INTO chats (id, user_id, title, timestamp, parent_chat_id, branch_from_message_id, branches)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            chat.id,
            userId,
            chat.title,
            chat.timestamp,
            chat.parentChatId || null,
            chat.branchFromMessageId || null,
            chat.branches || []
          ])
          uploadedChats++
        } else {
          // Update existing chat if local version is newer
          const serverTimestamp = new Date(existingChat.rows[0].updated_at)
          if (new Date(chat.timestamp) > serverTimestamp) {
            await client.query(`
              UPDATE chats 
              SET title = $1, timestamp = $2, parent_chat_id = $3, branch_from_message_id = $4, branches = $5, updated_at = CURRENT_TIMESTAMP
              WHERE id = $6 AND user_id = $7
            `, [
              chat.title,
            chat.timestamp,
            chat.parentChatId || null,
            chat.branchFromMessageId || null,
            chat.branches || [],
              chat.id,
              userId
            ])
            uploadedChats++
          }
        }

        // Sync messages for this chat
        if (chat.messages && Array.isArray(chat.messages)) {
          for (const message of chat.messages) {
            const existingMessage = await client.query(
              'SELECT id FROM messages WHERE id = $1 AND user_id = $2',
              [message.id, userId]
            )

            if (existingMessage.rows.length === 0) {
              // Insert new message
              await client.query(`
                INSERT INTO messages (id, chat_id, user_id, content, role, timestamp, position, attachments)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              `, [
                message.id,
                chat.id,
                userId,
                message.content,
                message.role,
                message.timestamp,
                message.position || null,
                JSON.stringify(message.attachments || [])
              ])
              uploadedMessages++
            }
          }
        }
      }

      // Update sync status
      await client.query(`
        INSERT INTO sync_status (user_id, last_sync_timestamp)
        VALUES ($1, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id)
        DO UPDATE SET last_sync_timestamp = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      `, [userId])

      await client.query('COMMIT')

      // Cache sync status in Redis
      await redis.hset(`sync:${userId}`, {
        lastSync: Date.now(),
        status: 'completed'
      })

      console.log(`[SYNC UPLOAD] Successfully uploaded ${uploadedChats} chats and ${uploadedMessages} messages for user ${userId}`)

      return NextResponse.json({
        success: true,
        message: `Successfully uploaded ${uploadedChats} chats and ${uploadedMessages} messages`,
        uploadedChats,
        uploadedMessages
      })

    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error: any) {
    console.error('Error uploading chats:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload chats' },
      { status: 500 }
    )
  }
}