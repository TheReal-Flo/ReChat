# Migration Plan: PostgreSQL/Redis to Convex

This document outlines the comprehensive migration plan from the current chat synchronization system (PostgreSQL + Redis + IndexedDB) to Convex.

## Current System Overview

### Current Architecture
- **Local Storage**: IndexedDB via Dexie for offline-first functionality
- **Server Storage**: PostgreSQL with tables for chats, messages, and sync_status
- **Cache Layer**: Redis for sync status tracking and performance
- **Sync Logic**: Custom ChatSyncService with manual conflict resolution
- **Authentication**: Clerk for user management

### Current Database Schema
```sql
-- Chats Table
CREATE TABLE chats (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  parent_chat_id VARCHAR(255),
  branch_from_message_id VARCHAR(255),
  branches TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Messages Table
CREATE TABLE messages (
  id VARCHAR(255) PRIMARY KEY,
  chat_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  role VARCHAR(20) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  position INTEGER,
  attachments JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Sync Status Table
CREATE TABLE sync_status (
  user_id VARCHAR(255) PRIMARY KEY,
  last_sync_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  device_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Target Convex Architecture

### Benefits of Migration
1. **Real-time Sync**: Automatic real-time updates without polling
2. **Simplified Architecture**: Single backend replacing PostgreSQL + Redis + custom sync logic
3. **Built-in Reactivity**: Automatic UI updates when data changes
4. **TypeScript-First**: End-to-end type safety
5. **Automatic Scaling**: No infrastructure management
6. **Optimistic Updates**: Better user experience with instant feedback

### Convex Schema Design
```typescript
// convex/schema.ts
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
  })
    .index("by_user", ["userId"])
    .index("by_user_timestamp", ["userId", "timestamp"]),

  messages: defineTable({
    chatId: v.id("chats"),
    userId: v.string(),
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    timestamp: v.number(),
    position: v.optional(v.number()),
    attachments: v.optional(v.any()),
    isDeleted: v.optional(v.boolean()),
  })
    .index("by_chat", ["chatId"])
    .index("by_user", ["userId"])
    .index("by_chat_position", ["chatId", "position"]),

  syncStatus: defineTable({
    userId: v.string(),
    lastSyncTimestamp: v.number(),
    deviceId: v.optional(v.string()),
  })
    .index("by_user", ["userId"]),
});
```

## Migration Strategy

### Phase 1: Setup and Preparation (Day 1-2)

#### 1.1 Install Convex
```bash
npm install convex
npx convex dev
```

#### 1.2 Initialize Convex Project
```bash
npx convex init
```

#### 1.3 Configure Authentication
```typescript
// convex/auth.config.js
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
```

#### 1.4 Create Schema
Create the Convex schema file with the structure above.

### Phase 2: Data Migration (Day 3-4)

#### 2.1 Export Current Data
Create a script to export all existing data from PostgreSQL:

```typescript
// scripts/export-data.ts
import { Pool } from 'pg';
import fs from 'fs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function exportData() {
  const chats = await pool.query('SELECT * FROM chats WHERE is_deleted = false');
  const messages = await pool.query('SELECT * FROM messages WHERE is_deleted = false');
  const syncStatus = await pool.query('SELECT * FROM sync_status');

  const exportData = {
    chats: chats.rows,
    messages: messages.rows,
    syncStatus: syncStatus.rows,
    exportedAt: new Date().toISOString(),
  };

  fs.writeFileSync('migration-data.json', JSON.stringify(exportData, null, 2));
  console.log('Data exported successfully');
}

exportData();
```

#### 2.2 Create Migration Functions
```typescript
// convex/migrations.ts
import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api.js";
import { DataModel } from "./_generated/dataModel.js";

export const migrations = new Migrations<DataModel>(components.migrations);

// Migration to import chats
export const importChats = migrations.define({
  table: "chats",
  migrateOne: async (ctx, doc) => {
    // This will be called for each chat during migration
    // Implementation will be added during migration
  },
});

// Migration to import messages
export const importMessages = migrations.define({
  table: "messages",
  migrateOne: async (ctx, doc) => {
    // This will be called for each message during migration
    // Implementation will be added during migration
  },
});

export const run = migrations.runner();
```

#### 2.3 Import Data to Convex
Create functions to import the exported data:

```typescript
// convex/importData.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const importChats = mutation({
  args: {
    chats: v.array(v.object({
      id: v.string(),
      userId: v.string(),
      title: v.string(),
      timestamp: v.string(),
      parentChatId: v.optional(v.string()),
      branchFromMessageId: v.optional(v.string()),
      branches: v.optional(v.array(v.string())),
    })),
  },
  handler: async (ctx, args) => {
    for (const chat of args.chats) {
      await ctx.db.insert("chats", {
        userId: chat.userId,
        title: chat.title,
        timestamp: new Date(chat.timestamp).getTime(),
        parentChatId: chat.parentChatId,
        branchFromMessageId: chat.branchFromMessageId,
        branches: chat.branches,
      });
    }
  },
});

export const importMessages = mutation({
  args: {
    messages: v.array(v.object({
      id: v.string(),
      chatId: v.string(),
      userId: v.string(),
      content: v.string(),
      role: v.string(),
      timestamp: v.string(),
      position: v.optional(v.number()),
      attachments: v.optional(v.any()),
    })),
  },
  handler: async (ctx, args) => {
    // First, create a mapping of old chat IDs to new Convex IDs
    const chatMapping = new Map();
    
    for (const message of args.messages) {
      let convexChatId = chatMapping.get(message.chatId);
      
      if (!convexChatId) {
        // Find the chat by original ID (stored in a temporary field during migration)
        const chat = await ctx.db
          .query("chats")
          .filter((q) => q.eq(q.field("originalId"), message.chatId))
          .first();
        
        if (chat) {
          convexChatId = chat._id;
          chatMapping.set(message.chatId, convexChatId);
        }
      }
      
      if (convexChatId) {
        await ctx.db.insert("messages", {
          chatId: convexChatId,
          userId: message.userId,
          content: message.content,
          role: message.role as "user" | "assistant",
          timestamp: new Date(message.timestamp).getTime(),
          position: message.position,
          attachments: message.attachments,
        });
      }
    }
  },
});
```

### Phase 3: Convex Functions Development (Day 5-7)

#### 3.1 Create Core Queries
```typescript
// convex/chats.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all chats for a user
export const getUserChats = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chats")
      .withIndex("by_user_timestamp", (q) => q.eq("userId", args.userId))
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .order("desc")
      .collect();
  },
});

// Get a specific chat with messages
export const getChatWithMessages = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get(args.chatId);
    if (!chat) return null;
    
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat_position", (q) => q.eq("chatId", args.chatId))
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .order("asc")
      .collect();
    
    return { ...chat, messages };
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
    });
  },
});

// Update chat
export const updateChat = mutation({
  args: {
    chatId: v.id("chats"),
    title: v.optional(v.string()),
    branches: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { chatId, ...updates } = args;
    return await ctx.db.patch(chatId, updates);
  },
});

// Delete chat (soft delete)
export const deleteChat = mutation({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.chatId, { isDeleted: true });
  },
});
```

#### 3.2 Create Message Functions
```typescript
// convex/messages.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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
    
    return await ctx.db.insert("messages", {
      chatId: args.chatId,
      userId: args.userId,
      content: args.content,
      role: args.role,
      timestamp: Date.now(),
      position,
      attachments: args.attachments,
    });
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
    return await ctx.db.patch(messageId, updates);
  },
});

// Delete message (soft delete)
export const deleteMessage = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.messageId, { isDeleted: true });
  },
});
```

### Phase 4: Frontend Integration (Day 8-10)

#### 4.1 Setup Convex Provider
```typescript
// app/layout.tsx
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
            {children}
          </ConvexProviderWithClerk>
        </ClerkProvider>
      </body>
    </html>
  );
}
```

#### 4.2 Create New Chat Service
```typescript
// lib/convex-chat-service.ts
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

export class ConvexChatService {
  // Get all chats for current user
  static useGetChats(userId: string) {
    return useQuery(api.chats.getUserChats, { userId });
  }
  
  // Get specific chat with messages
  static useGetChat(chatId: Id<"chats">) {
    return useQuery(api.chats.getChatWithMessages, { chatId });
  }
  
  // Create new chat
  static useCreateChat() {
    return useMutation(api.chats.createChat);
  }
  
  // Add message
  static useAddMessage() {
    return useMutation(api.messages.addMessage);
  }
  
  // Update chat
  static useUpdateChat() {
    return useMutation(api.chats.updateChat);
  }
  
  // Delete chat
  static useDeleteChat() {
    return useMutation(api.chats.deleteChat);
  }
}
```

#### 4.3 Update Chat Interface Component
```typescript
// components/chat-interface.tsx
import { useUser } from "@clerk/nextjs";
import { ConvexChatService } from "../lib/convex-chat-service";

export function ChatInterface() {
  const { user } = useUser();
  const userId = user?.id;
  
  // Real-time data with automatic updates
  const chats = ConvexChatService.useGetChats(userId!);
  const createChat = ConvexChatService.useCreateChat();
  const addMessage = ConvexChatService.useAddMessage();
  
  // No more manual sync needed - Convex handles real-time updates automatically
  
  const handleCreateChat = async (title: string) => {
    if (!userId) return;
    
    try {
      const chatId = await createChat({
        userId,
        title,
      });
      // UI will automatically update due to Convex reactivity
    } catch (error) {
      console.error('Failed to create chat:', error);
    }
  };
  
  const handleSendMessage = async (chatId: string, content: string) => {
    if (!userId) return;
    
    try {
      await addMessage({
        chatId: chatId as Id<"chats">,
        userId,
        content,
        role: "user",
      });
      // UI will automatically update due to Convex reactivity
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };
  
  // Rest of component implementation...
}
```

### Phase 5: Testing and Validation (Day 11-12)

#### 5.1 Data Integrity Verification
```typescript
// scripts/verify-migration.ts
import { ConvexHttpClient } from "convex/browser";
import { Pool } from 'pg';

const convex = new ConvexHttpClient(process.env.CONVEX_URL!);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function verifyMigration() {
  // Compare chat counts
  const pgChatCount = await pool.query('SELECT COUNT(*) FROM chats WHERE is_deleted = false');
  const convexChats = await convex.query("chats:getUserChats", { userId: "test-user" });
  
  console.log('PostgreSQL chats:', pgChatCount.rows[0].count);
  console.log('Convex chats:', convexChats.length);
  
  // Compare message counts
  const pgMessageCount = await pool.query('SELECT COUNT(*) FROM messages WHERE is_deleted = false');
  // Add similar verification for messages
  
  // Verify data integrity
  // Add checks for data consistency, relationships, etc.
}

verifyMigration();
```

#### 5.2 Performance Testing
- Load testing with realistic data volumes
- Real-time sync performance validation
- UI responsiveness testing

### Phase 6: Deployment and Cutover (Day 13-14)

#### 6.1 Parallel Running
- Run both systems in parallel for validation
- Compare real-time behavior
- Monitor for any discrepancies

#### 6.2 Feature Flag Implementation
```typescript
// lib/feature-flags.ts
export const useConvexSync = () => {
  return process.env.NEXT_PUBLIC_USE_CONVEX === 'true';
};

// In components
const isConvexEnabled = useConvexSync();
const chatService = isConvexEnabled ? ConvexChatService : ChatSyncService;
```

#### 6.3 Gradual Rollout
1. Enable Convex for internal testing (10% of users)
2. Expand to beta users (25% of users)
3. Full rollout (100% of users)
4. Remove old PostgreSQL/Redis infrastructure

## Post-Migration Cleanup

### Remove Legacy Code
1. Remove `lib/chat-sync.ts`
2. Remove PostgreSQL database tables
3. Remove Redis cache layer
4. Update documentation
5. Remove unused dependencies

### Update Dependencies
```bash
# Remove old dependencies
npm uninstall pg ioredis dexie

# Convex is already installed
# Update package.json scripts if needed
```

## Risk Mitigation

### Backup Strategy
1. Full PostgreSQL backup before migration
2. Export all data to JSON format
3. Keep old system running during transition
4. Implement rollback procedures

### Monitoring
1. Set up Convex dashboard monitoring
2. Implement error tracking
3. Monitor performance metrics
4. User feedback collection

### Rollback Plan
1. Feature flag to switch back to old system
2. Data export from Convex back to PostgreSQL
3. Restore from backup if needed
4. Communication plan for users

## Timeline Summary

- **Day 1-2**: Setup and preparation
- **Day 3-4**: Data migration
- **Day 5-7**: Convex functions development
- **Day 8-10**: Frontend integration
- **Day 11-12**: Testing and validation
- **Day 13-14**: Deployment and cutover

**Total Estimated Time**: 2 weeks

## Benefits After Migration

1. **Simplified Architecture**: Single backend instead of PostgreSQL + Redis + custom sync
2. **Real-time Updates**: Automatic UI updates without polling
3. **Better Developer Experience**: TypeScript-first with end-to-end type safety
4. **Reduced Maintenance**: No infrastructure management
5. **Improved Performance**: Optimized queries and automatic caching
6. **Better User Experience**: Instant updates and optimistic UI

This migration will significantly simplify the codebase while providing better real-time functionality and developer experience.