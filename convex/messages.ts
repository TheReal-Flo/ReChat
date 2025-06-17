import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// Add a message to a chat
export const addMessage = mutation({
  args: {
    chatId: v.id("chats"),
    userId: v.string(),
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    position: v.optional(v.number()),
    attachments: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Auto-generate position if not provided
    let position = args.position;
    if (position === undefined) {
      const lastMessage = await ctx.db
        .query("messages")
        .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
        .order("desc")
        .first();
      position = (lastMessage?.position ?? -1) + 1;
    }
    
    const messageId = await ctx.db.insert("messages", {
      chatId: args.chatId,
      userId: args.userId,
      content: args.content,
      role: args.role,
      timestamp: Date.now(),
      position,
      attachments: args.attachments,
      isDeleted: false,
    });
    
    // Update the chat's timestamp when a new message is added
    await ctx.db.patch(args.chatId, {
      timestamp: Date.now(),
    });
    
    return messageId;
  },
});

// Update a message
export const updateMessage = mutation({
  args: {
    messageId: v.id("messages"),
    content: v.optional(v.string()),
    attachments: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { messageId, ...updates } = args;
    
    // Get the message to update the chat timestamp
    const message = await ctx.db.get(messageId);
    if (!message) {
      throw new Error("Message not found");
    }
    
    // Update the message
    await ctx.db.patch(messageId, updates);
    
    // Update the chat's timestamp
    await ctx.db.patch(message.chatId, {
      timestamp: Date.now(),
    });
    
    return messageId;
  },
});

// Delete message (soft delete)
export const deleteMessage = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    // Get the message to update the chat timestamp
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }
    
    // Soft delete the message
    await ctx.db.patch(args.messageId, { isDeleted: true });
    
    // Update the chat's timestamp
    await ctx.db.patch(message.chatId, {
      timestamp: Date.now(),
    });
    
    return args.messageId;
  },
});

// Get messages by original ID (for migration purposes)
export const getMessageByOriginalId = query({
  args: { originalId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_original_id", (q) => q.eq("originalId", args.originalId))
      .first();
  },
});

// Create message with original ID (for migration purposes)
export const createMessageWithOriginalId = mutation({
  args: {
    originalId: v.string(),
    originalChatId: v.string(),
    chatId: v.id("chats"),
    userId: v.string(),
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    timestamp: v.number(),
    position: v.optional(v.number()),
    attachments: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      originalId: args.originalId,
      originalChatId: args.originalChatId,
      chatId: args.chatId,
      userId: args.userId,
      content: args.content,
      role: args.role,
      timestamp: args.timestamp,
      position: args.position,
      attachments: args.attachments,
      isDeleted: false,
    });
  },
});

// Batch create messages (for migration purposes)
export const batchCreateMessages = mutation({
  args: {
    messages: v.array(v.object({
      originalId: v.string(),
      originalChatId: v.string(),
      chatId: v.id("chats"),
      userId: v.string(),
      content: v.string(),
      role: v.union(v.literal("user"), v.literal("assistant")),
      timestamp: v.number(),
      position: v.optional(v.number()),
      attachments: v.optional(v.any()),
    })),
  },
  handler: async (ctx, args) => {
    const messageIds: string[] = [];
    
    for (const message of args.messages) {
      const messageId = await ctx.db.insert("messages", {
        originalId: message.originalId,
        originalChatId: message.originalChatId,
        chatId: message.chatId,
        userId: message.userId,
        content: message.content,
        role: message.role,
        timestamp: message.timestamp,
        position: message.position,
        attachments: message.attachments,
        isDeleted: false,
      });
      messageIds.push(messageId);
    }
    
    return messageIds;
  },
});

// Generate AI response action
export const generateAIResponse = action({
  args: {
    chatId: v.id("chats"),
    userId: v.string(),
    userMessage: v.string(),
    modelId: v.optional(v.string()),
    attachments: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    try {
      // Get chat messages for context
      const chat = await ctx.runQuery(api.chats.getChatWithMessages, {
        chatId: args.chatId,
      });
      
      if (!chat) {
        throw new Error('Chat not found');
      }
      
      // Prepare messages for API call (including the most recent user message)
      const messages = chat.messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
        attachments: msg.attachments,
      }));
      
      // Add the current user message to the context
      messages.push({
        role: 'user',
        content: args.userMessage,
        attachments: args.attachments,
      });
      
      // Call the streaming API with authentication
      const response = await fetch(`${process.env.CONVEX_BASE_URL || 'http://localhost:3000'}/api/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
          'x-user-id': args.userId,
        },
        body: JSON.stringify({
          modelId: args.modelId || 'gemini-2.0-flash',
          messages: messages,
          memoryEnabled: true,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }
      
      let assistantMessage = '';
       let assistantMessageId: any = null;
      
      // Process streaming response
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = new TextDecoder().decode(value);
        assistantMessage += chunk;
        
        // Add assistant message if not already added
        if (!assistantMessageId) {
          assistantMessageId = await ctx.runMutation(api.messages.addMessage, {
            chatId: args.chatId,
            userId: args.userId,
            content: assistantMessage,
            role: 'assistant',
          });
        } else {
          // Update existing assistant message
          await ctx.runMutation(api.messages.updateMessage, {
            messageId: assistantMessageId,
            content: assistantMessage,
          });
        }
      }
      
      return assistantMessageId;
    } catch (error) {
      console.error('Failed to generate AI response:', error);
      
      // Add error message
       const errorMessageId: any = await ctx.runMutation(api.messages.addMessage, {
        chatId: args.chatId,
        userId: args.userId,
        content: `Sorry, there was an error generating the AI response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        role: 'assistant',
      });
      
      return errorMessageId;
    }
  },
});

// Generate title action
export const generateTitle = action({
  args: {
    chatId: v.id("chats"),
    userId: v.string(),
    firstMessage: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Call the title generation API with authentication
      const response = await fetch(`${process.env.CONVEX_BASE_URL || 'http://localhost:3000'}/api/generate-title`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
          'x-user-id': args.userId,
        },
        body: JSON.stringify({
          message: args.firstMessage,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }
      
      const decoder = new TextDecoder();
      let title = '';
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          title += decoder.decode(value, { stream: true });
        }
      } finally {
        reader.releaseLock();
      }
      
      // Clean up the title (remove any extra whitespace)
      title = title.trim();
      
      if (title) {
        // Update the chat title using Convex mutation
        await ctx.runMutation(api.chats.updateChat, {
          chatId: args.chatId,
          title: title,
        });
        
        return title;
      } else {
        throw new Error('Empty title generated');
      }
    } catch (error) {
      console.error('Failed to generate title:', error);
      // Return a default title if generation fails
      const defaultTitle = args.firstMessage.slice(0, 50) + (args.firstMessage.length > 50 ? '...' : '');
      
      await ctx.runMutation(api.chats.updateChat, {
        chatId: args.chatId,
        title: defaultTitle,
      });
      
      return defaultTitle;
    }
  },
});