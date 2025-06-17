import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { Pool } from 'pg'
import Redis from 'ioredis'

// Initialize PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// Initialize Redis connection
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const chatId = searchParams.get('chatId')

    if (!chatId) {
      return NextResponse.json({ error: 'Chat ID is required' }, { status: 400 })
    }

    const client = await pool.connect()
    
    try {
      await client.query('BEGIN')

      // First, verify the chat belongs to the user
      const chatResult = await client.query(
        'SELECT id FROM chats WHERE id = $1 AND user_id = $2',
        [chatId, userId]
      )

      if (chatResult.rows.length === 0) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Chat not found or unauthorized' }, { status: 404 })
      }

      // Delete messages first (due to foreign key constraints)
      await client.query(
        'DELETE FROM messages WHERE chat_id = $1',
        [chatId]
      )

      // Delete the chat
      await client.query(
        'DELETE FROM chats WHERE id = $1 AND user_id = $2',
        [chatId, userId]
      )

      await client.query('COMMIT')

      // Update Redis cache - remove the deleted chat
      const cacheKey = `user_chats:${userId}`
      try {
        const cachedChats = await redis.get(cacheKey)
        if (cachedChats) {
          const chats = JSON.parse(cachedChats)
          const filteredChats = chats.filter((chat: any) => chat.id !== chatId)
          await redis.setex(cacheKey, 3600, JSON.stringify(filteredChats))
        }
      } catch (cacheError) {
        console.warn('Failed to update Redis cache after chat deletion:', cacheError)
      }

      // Update sync status
      try {
        await redis.hset(`sync_status:${userId}`, {
          lastSyncedAt: new Date().toISOString(),
          pendingChanges: 0
        })
      } catch (syncError) {
        console.warn('Failed to update sync status:', syncError)
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Chat deleted successfully',
        deletedChatId: chatId
      })

    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Error deleting chat:', error)
    return NextResponse.json(
      { error: 'Failed to delete chat' },
      { status: 500 }
    )
  }
}