import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  chats: defineTable({
    userId: v.string(),
    title: v.string(),
    timestamp: v.number(),
    parentChatId: v.optional(v.string()),
    branchFromMessageId: v.optional(v.string()),
    branches: v.optional(v.array(v.string())),
    isDeleted: v.optional(v.boolean()),
    pinned: v.optional(v.boolean()),
    // Temporary field for migration - will be removed after migration
    originalId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_timestamp", ["userId", "timestamp"])
    .index("by_original_id", ["originalId"]),

  messages: defineTable({
    chatId: v.id("chats"),
    userId: v.string(),
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    timestamp: v.number(),
    position: v.optional(v.number()),
    attachments: v.optional(v.any()),
    isDeleted: v.optional(v.boolean()),
    // Temporary field for migration - will be removed after migration
    originalId: v.optional(v.string()),
    originalChatId: v.optional(v.string()),
  })
    .index("by_chat", ["chatId"])
    .index("by_user", ["userId"])
    .index("by_chat_position", ["chatId", "position"])
    .index("by_original_id", ["originalId"]),

  syncStatus: defineTable({
    userId: v.string(),
    lastSyncTimestamp: v.number(),
    deviceId: v.optional(v.string()),
  })
    .index("by_user", ["userId"]),
});