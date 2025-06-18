import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

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
  args: { chatId: v.id("chats"), userId: v.string() },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get(args.chatId);
    if (!chat || chat.isDeleted) return null;
    
    // Authorization check: ensure the user owns this chat
    if (chat.userId !== args.userId) {
      throw new Error("Unauthorized: You don't have access to this chat");
    }
    
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
  args: { chatId: v.id("chats"), userId: v.string() },
  handler: async (ctx, args) => {
    // Authorization check: ensure the user owns this chat
    const chat = await ctx.db.get(args.chatId);
    if (!chat || chat.isDeleted) {
      throw new Error("Chat not found");
    }
    if (chat.userId !== args.userId) {
      throw new Error("Unauthorized: You don't have access to this chat");
    }
    
    return await ctx.db
      .query("messages")
      .withIndex("by_chat_position", (q) => q.eq("chatId", args.chatId))
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .order("asc")
      .collect();
  },
});

// Get branches of a specific chat
export const getChatBranches = query({
  args: { chatId: v.id("chats"), userId: v.string() },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get(args.chatId);
    if (!chat || chat.isDeleted || !chat.branches) {
      return [];
    }
    
    // Authorization check: ensure the user owns this chat
    if (chat.userId !== args.userId) {
      throw new Error("Unauthorized: You don't have access to this chat");
    }

    const branches = [];
    for (const branchId of chat.branches) {
      const branch = await ctx.db.get(branchId as Id<"chats">);
      if (branch && !branch.isDeleted && branch.userId === args.userId) {
        branches.push(branch);
      }
    }

    return branches;
  },
});

// Get parent chat of a branch
export const getParentChat = query({
  args: { chatId: v.id("chats"), userId: v.string() },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get(args.chatId);
    if (!chat || chat.isDeleted || !chat.parentChatId) {
      return null;
    }
    
    // Authorization check: ensure the user owns this chat
    if (chat.userId !== args.userId) {
      throw new Error("Unauthorized: You don't have access to this chat");
    }

    const parentChat = await ctx.db.get(chat.parentChatId as Id<"chats">);
    if (!parentChat || parentChat.isDeleted) {
      return null;
    }
    
    // Authorization check: ensure the user owns the parent chat too
    if (parentChat.userId !== args.userId) {
      throw new Error("Unauthorized: You don't have access to the parent chat");
    }

    return parentChat;
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
    userId: v.string(),
    title: v.optional(v.string()),
    branches: v.optional(v.array(v.string())),
    parentChatId: v.optional(v.string()),
    branchFromMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { chatId, userId, ...updates } = args;
    
    // Authorization check: ensure the user owns this chat
    const chat = await ctx.db.get(chatId);
    if (!chat || chat.isDeleted) {
      throw new Error("Chat not found");
    }
    if (chat.userId !== userId) {
      throw new Error("Unauthorized: You don't have access to this chat");
    }
    
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
  args: { chatId: v.id("chats"), userId: v.string() },
  handler: async (ctx, args) => {
    // Authorization check: ensure the user owns this chat
    const chat = await ctx.db.get(args.chatId);
    if (!chat || chat.isDeleted) {
      throw new Error("Chat not found");
    }
    if (chat.userId !== args.userId) {
      throw new Error("Unauthorized: You don't have access to this chat");
    }
    
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

// Create a branch from an existing chat
export const createBranch = mutation({
  args: {
    parentChatId: v.id("chats"),
    fromMessageId: v.id("messages"),
    userId: v.string(),
    newTitle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get the parent chat
    const parentChat = await ctx.db.get(args.parentChatId);
    if (!parentChat || parentChat.isDeleted) {
      throw new Error("Parent chat not found");
    }
    
    // Authorization check: ensure the user owns the parent chat
    if (parentChat.userId !== args.userId) {
      throw new Error("Unauthorized: You don't have access to this chat");
    }

    // Get the message to branch from
    const branchMessage = await ctx.db.get(args.fromMessageId);
    if (!branchMessage || branchMessage.isDeleted) {
      throw new Error("Branch message not found");
    }
    
    // Authorization check: ensure the user owns the message
    if (branchMessage.userId !== args.userId) {
      throw new Error("Unauthorized: You don't have access to this message");
    }

    // Generate a title for the new branch
    const branchTitle = args.newTitle || `Branch from: ${parentChat.title}`;

    // Create the new branch chat
    const branchChatId = await ctx.db.insert("chats", {
      userId: args.userId,
      title: branchTitle,
      timestamp: Date.now(),
      parentChatId: args.parentChatId,
      branchFromMessageId: args.fromMessageId,
      branches: [],
      isDeleted: false,
    });

    // Get all messages from parent chat up to and including the branch point
    const parentMessages = await ctx.db
      .query("messages")
      .withIndex("by_chat_position", (q) => q.eq("chatId", args.parentChatId))
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .order("asc")
      .collect();

    // Find the position of the branch message
    const branchMessageIndex = parentMessages.findIndex(msg => msg._id === args.fromMessageId);
    if (branchMessageIndex === -1) {
      throw new Error("Branch message not found in parent chat");
    }

    // Copy messages up to and including the branch point
    const messagesToCopy = parentMessages.slice(0, branchMessageIndex + 1);
    
    for (let i = 0; i < messagesToCopy.length; i++) {
      const originalMessage = messagesToCopy[i];
      await ctx.db.insert("messages", {
        chatId: branchChatId,
        userId: args.userId,
        content: originalMessage.content,
        role: originalMessage.role,
        timestamp: originalMessage.timestamp,
        position: i,
        attachments: originalMessage.attachments,
        isDeleted: false,
      });
    }

    // Update parent chat's branches array
    const updatedBranches = [...(parentChat.branches || []), branchChatId];
    await ctx.db.patch(args.parentChatId, {
      branches: updatedBranches,
      timestamp: Date.now(),
    });

    // Return the new branch chat
    return await ctx.db.get(branchChatId);
  },
});

// Toggle pin status of a chat
export const togglePinChat = mutation({
args: { chatId: v.id("chats"), userId: v.string() },
handler: async (ctx, args) => {
  const chat = await ctx.db.get(args.chatId);
  if (!chat || chat.isDeleted) {
    throw new Error("Chat not found");
  }
  
  // Authorization check: ensure the user owns this chat
  if (chat.userId !== args.userId) {
    throw new Error("Unauthorized: You don't have access to this chat");
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