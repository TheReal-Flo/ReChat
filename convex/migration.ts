import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Import chats from PostgreSQL data
export const importChats = mutation({
  args: {
    chats: v.array(v.object({
      originalId: v.string(),
      userId: v.string(),
      title: v.string(),
      timestamp: v.number(),
      parentChatId: v.optional(v.string()),
      branchFromMessageId: v.optional(v.string()),
      branches: v.optional(v.array(v.string())),
    })),
  },
  handler: async (ctx, args) => {
    const importedChats = [];
    
    for (const chat of args.chats) {
      // Check if chat already exists
      const existing = await ctx.db
        .query("chats")
        .withIndex("by_original_id", (q) => q.eq("originalId", chat.originalId))
        .first();
      
      if (!existing) {
        const chatId = await ctx.db.insert("chats", {
          originalId: chat.originalId,
          userId: chat.userId,
          title: chat.title,
          timestamp: chat.timestamp,
          parentChatId: chat.parentChatId,
          branchFromMessageId: chat.branchFromMessageId,
          branches: chat.branches || [],
          isDeleted: false,
        });
        
        importedChats.push({
          originalId: chat.originalId,
          convexId: chatId,
          title: chat.title,
        });
      }
    }
    
    return {
      imported: importedChats.length,
      chats: importedChats,
    };
  },
});

// Import messages from PostgreSQL data
export const importMessages = mutation({
  args: {
    messages: v.array(v.object({
      originalId: v.string(),
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
    const importedMessages = [];
    const errors = [];
    
    for (const message of args.messages) {
      try {
        // Check if message already exists
        const existing = await ctx.db
          .query("messages")
          .withIndex("by_original_id", (q) => q.eq("originalId", message.originalId))
          .first();
        
        if (!existing) {
          const messageId = await ctx.db.insert("messages", {
            originalId: message.originalId,
            chatId: message.chatId,
            userId: message.userId,
            content: message.content,
            role: message.role,
            timestamp: message.timestamp,
            position: message.position,
            attachments: message.attachments,
            isDeleted: false,
          });
            
            importedMessages.push({
              originalId: message.originalId,
              convexId: messageId,
              chatId: message.chatId,
            });
        }
      } catch (error) {
        errors.push(`Error importing message ${message.originalId}: ${error}`);
      }
    }
    
    return {
      imported: importedMessages.length,
      errors: errors.length,
      errorDetails: errors,
      messages: importedMessages,
    };
  },
});

// Import sync status from PostgreSQL data
export const importSyncStatus = mutation({
  args: {
    syncStatuses: v.array(v.object({
      userId: v.string(),
      lastSyncTimestamp: v.number(),
      deviceId: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const importedStatuses = [];
    
    for (const status of args.syncStatuses) {
      // Check if sync status already exists
      const existing = await ctx.db
        .query("syncStatus")
        .withIndex("by_user", (q) => q.eq("userId", status.userId))
        .first();
      
      if (!existing) {
        const statusId = await ctx.db.insert("syncStatus", {
          userId: status.userId,
          lastSyncTimestamp: status.lastSyncTimestamp,
          deviceId: status.deviceId,
        });
        
        importedStatuses.push({
          userId: status.userId,
          convexId: statusId,
        });
      } else {
        // Update existing sync status if the imported one is newer
        if (status.lastSyncTimestamp > existing.lastSyncTimestamp) {
          await ctx.db.patch(existing._id, {
            lastSyncTimestamp: status.lastSyncTimestamp,
            deviceId: status.deviceId,
          });
          
          importedStatuses.push({
            userId: status.userId,
            convexId: existing._id,
            updated: true,
          });
        }
      }
    }
    
    return {
      imported: importedStatuses.length,
      statuses: importedStatuses,
    };
  },
});

// Get migration status
export const getMigrationStatus = query({
  args: {},
  handler: async (ctx) => {
    const totalChats = await ctx.db.query("chats").collect();
    const totalMessages = await ctx.db.query("messages").collect();
    const totalSyncStatuses = await ctx.db.query("syncStatus").collect();
    
    const chatsWithOriginalId = totalChats.filter(chat => chat.originalId);
    const messagesWithOriginalId = totalMessages.filter(message => message.originalId);
    
    return {
      chats: {
        total: totalChats.length,
        migrated: chatsWithOriginalId.length,
        native: totalChats.length - chatsWithOriginalId.length,
      },
      messages: {
        total: totalMessages.length,
        migrated: messagesWithOriginalId.length,
        native: totalMessages.length - messagesWithOriginalId.length,
      },
      syncStatuses: {
        total: totalSyncStatuses.length,
      },
    };
  },
});

// Clean up migration fields (remove originalId and originalChatId)
export const cleanupMigrationFields = mutation({
  args: {},
  handler: async (ctx) => {
    // Clean up chats
    const chats = await ctx.db.query("chats").collect();
    let cleanedChats = 0;
    
    for (const chat of chats) {
      if (chat.originalId) {
        await ctx.db.patch(chat._id, {
          originalId: undefined,
        });
        cleanedChats++;
      }
    }
    
    // Clean up messages
    const messages = await ctx.db.query("messages").collect();
    let cleanedMessages = 0;
    
    for (const message of messages) {
      if (message.originalId || message.originalChatId) {
        await ctx.db.patch(message._id, {
          originalId: undefined,
          originalChatId: undefined,
        });
        cleanedMessages++;
      }
    }
    
    return {
      cleanedChats,
      cleanedMessages,
    };
  },
});

// Verify data integrity after migration
export const verifyDataIntegrity = query({
  args: {},
  handler: async (ctx) => {
    const chats = await ctx.db.query("chats").collect();
    const messages = await ctx.db.query("messages").collect();
    
    const issues = [];
    
    // Check for orphaned messages (messages without valid chat)
    for (const message of messages) {
      const chat = await ctx.db.get(message.chatId);
      if (!chat) {
        issues.push(`Orphaned message: ${message._id} references non-existent chat ${message.chatId}`);
      }
    }
    
    // Check for chats without messages
    const chatsWithoutMessages = [];
    for (const chat of chats) {
      const chatMessages = messages.filter(m => m.chatId === chat._id);
      if (chatMessages.length === 0) {
        chatsWithoutMessages.push(chat._id);
      }
    }
    
    return {
      totalChats: chats.length,
      totalMessages: messages.length,
      orphanedMessages: issues.length,
      chatsWithoutMessages: chatsWithoutMessages.length,
      issues,
    };
  },
});