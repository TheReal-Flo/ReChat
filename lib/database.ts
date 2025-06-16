import Dexie, { Table } from 'dexie'
import type { Chat, Message } from '../types/chat'

export class ChatDatabase extends Dexie {
  chats!: Table<Chat>
  messages!: Table<Message>

  constructor() {
    super('ChatDatabase')
    this.version(1).stores({
      chats: 'id, title, timestamp',
      messages: 'id, chatId, content, role, timestamp'
    })
    this.version(2).stores({
      chats: 'id, title, timestamp, parentChatId',
      messages: 'id, chatId, content, role, timestamp, position'
    })
  }
}

export const db = new ChatDatabase()

// Database operations
export const chatService = {
  // Get all chats
  async getAllChats(): Promise<Chat[]> {
    const chats = await db.chats.orderBy('timestamp').reverse().toArray()
    
    // Get messages for each chat
    const chatsWithMessages = await Promise.all(
      chats.map(async (chat) => {
        const messages = await db.messages
          .where('chatId')
          .equals(chat.id)
          .sortBy('timestamp')
        return { ...chat, messages }
      })
    )
    
    return chatsWithMessages
  },

  // Get a specific chat by ID
  async getChatById(id: string): Promise<Chat | undefined> {
    const chat = await db.chats.get(id)
    if (!chat) return undefined
    
    const messages = await db.messages
      .where('chatId')
      .equals(id)
      .toArray()
    
    // Sort by position first, then by timestamp
    messages.sort((a, b) => {
      if (a.position !== undefined && b.position !== undefined) {
        return a.position - b.position
      }
      return a.timestamp.getTime() - b.timestamp.getTime()
    })
    
    return { ...chat, messages }
  },

  // Create a new chat
  async createChat(title: string, parentChatId?: string, branchFromMessageId?: string): Promise<Chat> {
    const newChat: Chat = {
      id: crypto.randomUUID(),
      title,
      timestamp: new Date(),
      messages: [],
      parentChatId,
      branchFromMessageId,
      branches: []
    }
    
    await db.chats.add(newChat)
    
    // If this is a branch, update parent chat's branches array
    if (parentChatId) {
      const parentChat = await this.getChatById(parentChatId)
      if (parentChat) {
        const updatedBranches = [...(parentChat.branches || []), newChat.id]
        await db.chats.update(parentChatId, { branches: updatedBranches })
      }
    }
    
    return newChat
  },

  // Add a message to a chat
  async addMessage(chatId: string, content: string, role: 'user' | 'assistant', attachments?: { name: string; type: string; url?: string }[], position?: number): Promise<Message> {
    // If position is not provided, calculate it as the next position
    if (position === undefined) {
      const existingMessages = await db.messages.where('chatId').equals(chatId).toArray()
      position = existingMessages.length
    }
    
    const message: Message = {
      id: crypto.randomUUID(),
      content,
      role,
      timestamp: new Date(),
      attachments,
      position
    }
    
    // Add chatId for database storage (extend the interface for internal use)
    const messageWithChatId = { ...message, chatId }
    
    await db.messages.add(messageWithChatId)
    
    // Update chat timestamp
    await db.chats.update(chatId, { timestamp: new Date() })
    
    return message
  },

  // Delete a chat and its messages
  async deleteChat(id: string): Promise<void> {
    await db.transaction('rw', db.chats, db.messages, async () => {
      await db.chats.delete(id)
      await db.messages.where('chatId').equals(id).delete()
    })
  },

  // Update chat title
  async updateChatTitle(id: string, title: string): Promise<void> {
    await db.chats.update(id, { title })
  },

  // Update message content
  async updateMessage(chatId: string, messageId: string, content: string): Promise<void> {
    await db.messages.update(messageId, { content })
    // Update chat timestamp
    await db.chats.update(chatId, { timestamp: new Date() })
  },

  // Search chats by title
  async searchChats(query: string): Promise<Chat[]> {
    const allChats = await this.getAllChats()
    return allChats.filter(chat => 
      chat.title.toLowerCase().includes(query.toLowerCase())
    )
  },

  // Initialize with sample data (for first-time users)
  async initializeSampleData(): Promise<void> {
    const existingChats = await db.chats.count()
    if (existingChats > 0) return // Don't add sample data if chats already exist
    
    const sampleChat = await this.createChat('Welcome to ReChat')
    await this.addMessage(
      sampleChat.id,
      'Hello! Welcome to ReChat. This is your first conversation. You can start chatting with AI models right away!',
      'assistant'
    )
  },

  // Create a branch from a specific message
  async createBranch(parentChatId: string, fromMessageId: string, newTitle?: string): Promise<Chat> {
    const parentChat = await this.getChatById(parentChatId)
    if (!parentChat) throw new Error('Parent chat not found')
    
    const fromMessage = parentChat.messages.find(m => m.id === fromMessageId)
    if (!fromMessage) throw new Error('Message not found')
    
    // Generate title for branch
    const title = newTitle || `${parentChat.title} (Branch)`
    
    // Create new chat as a branch
    const branchChat = await this.createChat(title, parentChatId, fromMessageId)
    
    // Copy messages up to and including the branch point
    const messagesToCopy = parentChat.messages.filter(m => 
      m.position !== undefined && fromMessage.position !== undefined && 
      m.position <= fromMessage.position
    )
    
    for (const message of messagesToCopy) {
      await this.addMessage(
        branchChat.id,
        message.content,
        message.role,
        message.attachments,
        message.position
      )
    }
    
    return branchChat
  },



  // Get all branches of a chat
  async getChatBranches(chatId: string): Promise<Chat[]> {
    const chat = await this.getChatById(chatId)
    if (!chat || !chat.branches) return []
    
    const branches = await Promise.all(
      chat.branches.map(branchId => this.getChatById(branchId))
    )
    
    return branches.filter(branch => branch !== undefined) as Chat[]
  },

  // Get parent chat
  async getParentChat(chatId: string): Promise<Chat | undefined> {
    const chat = await this.getChatById(chatId)
    if (!chat || !chat.parentChatId) return undefined
    
    return this.getChatById(chat.parentChatId)
  },

  // Delete messages from a specific message onwards (for resend functionality)
  async deleteMessagesFromPoint(chatId: string, fromMessageId: string): Promise<void> {
    const chat = await this.getChatById(chatId)
    if (!chat) throw new Error('Chat not found')
    
    const fromMessage = chat.messages.find(m => m.id === fromMessageId)
    if (!fromMessage || fromMessage.position === undefined) throw new Error('Message not found')
    
    // Delete all messages from this position onwards
    const messagesToDelete = chat.messages.filter(m => 
      m.position !== undefined && m.position >= fromMessage.position!
    )
    
    await db.transaction('rw', db.messages, async () => {
      for (const message of messagesToDelete) {
        await db.messages.delete(message.id)
      }
    })
    
    // Update chat timestamp
    await db.chats.update(chatId, { timestamp: new Date() })
  }
}