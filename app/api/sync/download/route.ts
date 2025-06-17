import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { Pool } from 'pg'
import type { Chat } from '../../../../types/chat'

// Server-side database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// GET: Download server chats to client
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const client = await pool.connect()
    
    try {
      // Get all server chats for user
      const serverChats = await client.query(`
        SELECT * FROM chats 
        WHERE user_id = $1 AND is_deleted = FALSE
        ORDER BY timestamp DESC
      `, [userId])

      const chats: Chat[] = []

      for (const serverChat of serverChats.rows) {
        // Get messages for this chat
        const serverMessages = await client.query(`
          SELECT * FROM messages 
          WHERE chat_id = $1 AND user_id = $2 AND is_deleted = FALSE
          ORDER BY position, timestamp
        `, [serverChat.id, userId])

        // Convert server data to client format
        const chat: Chat = {
          id: serverChat.id,
          title: serverChat.title,
          timestamp: new Date(serverChat.timestamp),
          parentChatId: serverChat.parent_chat_id,
          branchFromMessageId: serverChat.branch_from_message_id,
          branches: serverChat.branches || [],
          createdAt: new Date(serverChat.created_at),
          updatedAt: new Date(serverChat.updated_at),
          messages: serverMessages.rows.map(msg => ({
            id: msg.id,
            content: msg.content,
            role: msg.role as 'user' | 'assistant',
            timestamp: new Date(msg.timestamp),
            position: msg.position,
            createdAt: new Date(msg.created_at),
            updatedAt: new Date(msg.updated_at),
            attachments: msg.attachments && msg.attachments !== '' ? (() => {
              try {
                return JSON.parse(msg.attachments)
              } catch (e) {
                console.warn(`[SYNC DOWNLOAD] Failed to parse attachments for message ${msg.id}:`, e)
                return []
              }
            })() : []
          }))
        }

        chats.push(chat)
      }

      console.log(`[SYNC DOWNLOAD] Retrieved ${chats.length} chats for user ${userId}`)

      return NextResponse.json({
        success: true,
        chats,
        count: chats.length
      })

    } finally {
      client.release()
    }
  } catch (error: any) {
    console.error('Error downloading chats:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to download chats' },
      { status: 500 }
    )
  }
}