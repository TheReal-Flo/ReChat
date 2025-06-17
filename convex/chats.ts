import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all chats for a user
export const getUserChats = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const chats = await ctx.db
      .query("chats")
      .withIndex("by_user_timestamp", (q) => q.eq("userId", args.userId))
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .collect();
    
    // Sort chats: pinned chats first, then by timestamp (newest first)
    return chats.sort((a, b) => {
      // If one is pinned and the other isn't, pinned comes first
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      
      // If both have same pinned status, sort by timestamp (newest first)
      return b.timestamp - a.timestamp;
    });
  },
});

// Get a specific chat with messages
export const getChatWithMessages = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get(args.chatId);
    if (!chat || chat.isDeleted) return null;
    
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat_position", (q) => q.eq("chatId", args.chatId))
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .order("asc")
      .collect();
    
    return { ...chat, messages };
  },
});

// Get messages for a specific chat
export const getChatMessages = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_chat_position", (q) => q.eq("chatId", args.chatId))
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .order("asc")
      .collect();
  },
});

// Create a new chat
export const createChat = mutation({
  args: {
    userId: v.string(),
    title: v.string(),
    parentChatId: v.optional(v.string()),
    branchFromMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("chats", {
      userId: args.userId,
      title: args.title,
      timestamp: Date.now(),
      parentChatId: args.parentChatId,
      branchFromMessageId: args.branchFromMessageId,
      branches: [],
      isDeleted: false,
    });
  },
});

// Update chat
export const updateChat = mutation({
  args: {
    chatId: v.id("chats"),
    title: v.optional(v.string()),
    branches: v.optional(v.array(v.string())),
    parentChatId: v.optional(v.string()),
    branchFromMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { chatId, ...updates } = args;
    
    // Update timestamp when chat is modified
    const updateData = {
      ...updates,
      timestamp: Date.now(),
    };
    
    return await ctx.db.patch(chatId, updateData);
  },
});

// Delete chat (soft delete)
export const deleteChat = mutation({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    // Also soft delete all messages in this chat
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .collect();
    
    // Delete all messages
    for (const message of messages) {
      await ctx.db.patch(message._id, { isDeleted: true });
    }
    
    // Delete the chat
  return await ctx.db.patch(args.chatId, { isDeleted: true });
},
});

// Toggle pin status of a chat
export const togglePinChat = mutation({
args: { chatId: v.id("chats") },
handler: async (ctx, args) => {
  const chat = await ctx.db.get(args.chatId);
  if (!chat || chat.isDeleted) {
    throw new Error("Chat not found");
  }
  
  return await ctx.db.patch(args.chatId, {
    pinned: !chat.pinned,
    timestamp: Date.now(),
  });
},
});

// Get chat by original ID (for migration purposes)
export const getChatByOriginalId = query({
  args: { originalId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chats")
      .withIndex("by_original_id", (q) => q.eq("originalId", args.originalId))
      .first();
  },
});

// Create chat with original ID (for migration purposes)
export const createChatWithOriginalId = mutation({
  args: {
    originalId: v.string(),
    userId: v.string(),
    title: v.string(),
    timestamp: v.number(),
    parentChatId: v.optional(v.string()),
    branchFromMessageId: v.optional(v.string()),
    branches: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("chats", {
      originalId: args.originalId,
      userId: args.userId,
      title: args.title,
      timestamp: args.timestamp,
      parentChatId: args.parentChatId,
      branchFromMessageId: args.branchFromMessageId,
      branches: args.branches || [],
      isDeleted: false,
    });
  },
});