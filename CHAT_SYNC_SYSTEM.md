# Chat Synchronization System

This document describes the chat synchronization system that enables users to sync their chat history across multiple devices using PostgreSQL and Redis.

## Overview

The chat sync system provides:
- **Cross-device synchronization**: Access your chats from any device
- **Real-time sync**: Automatic synchronization every 5 minutes
- **Manual sync controls**: Upload, download, or full sync options
- **Conflict resolution**: Server-side timestamps determine the latest version
- **Offline support**: Local storage continues to work when offline

## Architecture

### Hybrid Storage System

1. **Local Storage (IndexedDB via Dexie)**
   - Primary storage for immediate access
   - Works offline
   - Fast read/write operations
   - Stores complete chat history locally

2. **Server Storage (PostgreSQL)**
   - Persistent cloud storage
   - Cross-device synchronization
   - User-specific data isolation
   - Backup and recovery

3. **Cache Layer (Redis)**
   - Sync status tracking
   - Performance optimization
   - Session management

### Database Schema

#### Chats Table
```sql
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
```

#### Messages Table
```sql
CREATE TABLE messages (
  id VARCHAR(255) PRIMARY KEY,
  chat_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  timestamp TIMESTAMP NOT NULL,
  position INTEGER,
  attachments JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);
```

#### Sync Status Table
```sql
CREATE TABLE sync_status (
  user_id VARCHAR(255) PRIMARY KEY,
  last_sync_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  device_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Components

### 1. ChatSyncService (`lib/chat-sync.ts`)

Core synchronization logic:

```typescript
// Sync local changes to server
await ChatSyncService.syncToServer(userId)

// Sync server changes to local
await ChatSyncService.syncFromServer(userId)

// Full bidirectional sync
await ChatSyncService.performFullSync(userId)

// Auto-sync (called on app startup)
await ChatSyncService.autoSync(userId)
```

### 2. Sync API (`app/api/sync/route.ts`)

HTTP endpoints for sync operations:

- `GET /api/sync` - Get sync status
- `POST /api/sync` - Trigger manual sync

### 3. SyncDashboard Component (`components/SyncDashboard.tsx`)

User interface for sync management:
- View sync status
- Manual sync controls
- Online/offline indicator
- Last sync timestamp

## Sync Flow

### Automatic Sync

1. **App Startup**
   - Check if user is authenticated
   - Get last sync timestamp
   - If > 5 minutes since last sync, trigger full sync
   - Continue with normal app operation

2. **Periodic Sync** (Future Enhancement)
   - Background sync every 5 minutes when online
   - Only sync if there are changes

### Manual Sync Options

1. **Full Sync**
   - Sync local → server
   - Sync server → local
   - Resolve conflicts using timestamps

2. **Upload to Cloud**
   - Push local chats to server
   - Useful when switching devices

3. **Download from Cloud**
   - Pull server chats to local
   - Useful for new device setup

### Conflict Resolution

- **Chat Level**: Latest `updated_at` timestamp wins
- **Message Level**: Messages are append-only, no conflicts
- **Branching**: Preserved across sync operations

## Setup Instructions

### 1. Environment Variables

Add to your `.env.local`:

```env
# Database Configuration
DATABASE_URL=postgres://username:password@localhost:5432/chat_interface
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
NODE_ENV=development

# Sync Configuration
SYNC_ENABLED=true
DEVICE_ID=default
```

### 2. Database Setup

The database tables are automatically created when the usage system initializes:

```typescript
import { UsageTracker } from './lib/usage-db'

// Initialize all database tables (including sync tables)
await UsageTracker.initializeDatabase()
```

### 3. Authentication

Sync requires user authentication via Clerk:

```typescript
import { useUser } from '@clerk/nextjs'

const { user } = useUser()
if (user?.id) {
  await chatSync.autoSync(user.id)
}
```

## Usage

### In React Components

```typescript
import { chatSync } from './lib/chat-sync'
import { useUser } from '@clerk/nextjs'

function MyComponent() {
  const { user } = useUser()
  
  const handleSync = async () => {
    if (user?.id) {
      await chatSync.performFullSync(user.id)
    }
  }
  
  return (
    <button onClick={handleSync}>
      Sync Chats
    </button>
  )
}
```

### API Usage

```javascript
// Get sync status
const response = await fetch('/api/sync')
const status = await response.json()

// Trigger full sync
const syncResponse = await fetch('/api/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ direction: 'full' })
})
```

## Error Handling

### Network Errors
- Graceful degradation to local-only mode
- Retry logic for temporary failures
- User notification of sync status

### Data Conflicts
- Timestamp-based resolution
- Preserve both versions when possible
- User notification of conflicts

### Authentication Errors
- Disable sync for unauthenticated users
- Clear sync status on logout
- Re-enable sync on login

## Performance Considerations

### Optimization Strategies

1. **Incremental Sync**
   - Only sync changed data
   - Use timestamps to identify changes
   - Batch operations for efficiency

2. **Caching**
   - Redis cache for sync status
   - Local cache for recent operations
   - Minimize database queries

3. **Background Processing**
   - Non-blocking sync operations
   - Progress indicators for long operations
   - Graceful handling of interruptions

### Database Indexes

```sql
-- Performance indexes
CREATE INDEX idx_chats_user_id ON chats(user_id);
CREATE INDEX idx_chats_timestamp ON chats(user_id, timestamp DESC);
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_user_timestamp ON messages(user_id, timestamp);
CREATE INDEX idx_messages_position ON messages(chat_id, position);
```

## Monitoring

### Key Metrics

- Sync success/failure rates
- Sync duration times
- Data transfer volumes
- User sync frequency
- Error rates by type

### Logging

```typescript
// Sync operation logging
console.log(`Sync started for user: ${userId}`)
console.log(`Sync completed: ${syncedChats} chats, ${syncedMessages} messages`)
console.error(`Sync failed: ${error.message}`)
```

## Security

### Data Protection

- User data isolation by `user_id`
- SQL injection prevention
- Input validation and sanitization
- Secure database connections

### Authentication

- Clerk authentication required
- JWT token validation
- Session management
- Automatic logout handling

## Troubleshooting

### Common Issues

1. **Sync Not Working**
   - Check authentication status
   - Verify database connection
   - Check Redis connectivity
   - Review error logs

2. **Data Not Appearing**
   - Check sync status
   - Verify user ID consistency
   - Check database permissions
   - Review sync timestamps

3. **Performance Issues**
   - Monitor database query performance
   - Check Redis cache hit rates
   - Review network connectivity
   - Optimize sync frequency

### Debug Commands

```typescript
// Check sync status
const status = await ChatSyncService.getSyncStatus(userId)
console.log('Sync status:', status)

// Force full sync
await ChatSyncService.performFullSync(userId)

// Check local vs server data
const localChats = await chatService.getAllChats()
console.log('Local chats:', localChats.length)
```

## Future Enhancements

### Planned Features

1. **Real-time Sync**
   - WebSocket connections
   - Live collaboration
   - Instant updates

2. **Conflict Resolution UI**
   - Visual diff interface
   - Manual conflict resolution
   - Merge options

3. **Selective Sync**
   - Choose which chats to sync
   - Folder-based organization
   - Sync preferences

4. **Backup and Export**
   - Full data export
   - Scheduled backups
   - Import from other platforms

5. **Advanced Caching**
   - Intelligent prefetching
   - Offline queue management
   - Compression for large chats

## API Reference

### ChatSyncService Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|----------|
| `syncToServer(userId)` | Upload local chats to server | `userId: string` | `Promise<void>` |
| `syncFromServer(userId)` | Download server chats to local | `userId: string` | `Promise<void>` |
| `performFullSync(userId)` | Bidirectional sync | `userId: string` | `Promise<void>` |
| `getSyncStatus(userId)` | Get sync status | `userId: string` | `Promise<SyncStatus>` |
| `autoSync(userId)` | Auto-sync on startup | `userId: string` | `Promise<void>` |

### API Endpoints

| Endpoint | Method | Description | Response |
|----------|--------|-------------|----------|
| `/api/sync` | GET | Get sync status | `SyncStatus` |
| `/api/sync` | POST | Trigger sync | `{ message, status }` |

### Types

```typescript
interface SyncStatus {
  lastSyncTimestamp: Date
  pendingChanges: number
  isOnline: boolean
}
```