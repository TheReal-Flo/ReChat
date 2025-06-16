# Resumable Streaming System

This document describes the implementation of the resumable streaming system using Redis for persistent stream state storage.

## Overview

The resumable streaming system allows chat streams to persist even if the site is reloaded or the connection is interrupted. Stream state is stored in Redis, enabling users to resume conversations from where they left off.

## Architecture

### Components

1. **StreamManager** (`lib/stream-manager.ts`)
   - Core service for managing stream state in Redis
   - Handles stream creation, updates, completion, and cleanup
   - Provides validation and ownership checks

2. **API Endpoints**
   - `POST /api/stream/start` - Initialize a new resumable stream
   - `GET /api/stream/resume/[streamId]` - Resume an existing stream
   - `GET /api/stream/status/[streamId]` - Get stream status
   - `DELETE /api/stream/cancel/[streamId]` - Cancel a stream
   - `POST /api/stream/cleanup` - Manual cleanup operations

3. **Client Hook** (`hooks/use-resumable-stream.ts`)
   - React hook for managing resumable streams on the client side
   - Handles reconnection logic and state persistence

4. **Cleanup Service** (`lib/stream-cleanup.ts`)
   - Automatic cleanup of expired streams
   - Configurable cleanup intervals

## Redis Schema

### Stream State
Stored at key: `stream:{streamId}`
```json
{
  "chatId": "string",
  "messageId": "string", 
  "userId": "string",
  "modelId": "string",
  "messages": [],
  "accumulatedContent": "string",
  "status": "active|completed|error|cancelled",
  "startTime": "ISO string",
  "lastActivity": "ISO string",
  "position": "number"
}
```

### User Active Streams
Stored at key: `user_streams:{userId}`
- Redis Set containing active stream IDs for each user
- Used for cleanup and user stream management

## Usage

### Starting a Stream

```typescript
// Client-side
const response = await fetch('/api/stream/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chatId: 'chat-123',
    messageId: 'msg-456', 
    modelId: 'gemini-2.0-flash',
    messages: [...]
  })
})

const { streamId } = await response.json()
```

### Resuming a Stream

```typescript
// Client-side
const response = await fetch(`/api/stream/resume/${streamId}`)
const reader = response.body?.getReader()

// Process streaming content
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  
  const chunk = new TextDecoder().decode(value)
  // Handle chunk...
}
```

### Using the React Hook

```typescript
import { useResumableStream } from './hooks/use-resumable-stream'

function ChatComponent() {
  const {
    streamId,
    content,
    status,
    error,
    startStream,
    resumeStream,
    cancelStream
  } = useResumableStream({
    onContent: (content) => console.log('New content:', content),
    onComplete: () => console.log('Stream completed'),
    onError: (error) => console.error('Stream error:', error)
  })

  const handleSendMessage = async () => {
    await startStream({
      chatId: 'chat-123',
      messageId: 'msg-456',
      modelId: 'gemini-2.0-flash', 
      messages: [...]
    })
  }

  return (
    <div>
      <button onClick={handleSendMessage}>Send Message</button>
      <div>{content}</div>
      <div>Status: {status}</div>
    </div>
  )
}
```

## Configuration

### Environment Variables

```env
# Redis connection
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password

# Stream settings
STREAM_TTL_SECONDS=3600  # 1 hour default
CLEANUP_INTERVAL_MS=300000  # 5 minutes default
```

### Redis Configuration

Ensure Redis is running and accessible. The system uses:
- String keys for stream state storage
- Set keys for user active streams tracking
- TTL for automatic expiration

## Error Handling

### Stream Errors
- Network interruptions: Automatic reconnection with exponential backoff
- Redis failures: Graceful degradation to non-resumable streaming
- Invalid stream IDs: Clear error messages and cleanup

### Cleanup
- Expired streams are automatically removed
- Manual cleanup available via API
- User stream sets are maintained for consistency

## Security

### Authentication
- All endpoints require Clerk authentication
- Stream ownership validation prevents unauthorized access
- User isolation through userId-based keys

### Data Protection
- Stream content is stored temporarily in Redis
- Automatic expiration prevents data accumulation
- No sensitive data logged in stream operations

## Monitoring

### Logging
- Stream lifecycle events logged with prefixes
- Error conditions logged with context
- Cleanup operations tracked

### Metrics
- Stream creation/completion rates
- Error frequencies
- Cleanup effectiveness
- Redis memory usage

## Troubleshooting

### Common Issues

1. **Stream not resuming**
   - Check Redis connectivity
   - Verify stream hasn't expired
   - Confirm user authentication

2. **Memory issues**
   - Monitor Redis memory usage
   - Adjust TTL settings
   - Run manual cleanup

3. **Connection problems**
   - Check network stability
   - Verify Redis configuration
   - Review error logs

### Debug Commands

```bash
# Check Redis connection
redis-cli ping

# List active streams
redis-cli keys "stream:*"

# Check user streams
redis-cli smembers "user_streams:user_123"

# Manual cleanup
curl -X POST /api/stream/cleanup -d '{"action":"force"}'
```

## Performance Considerations

### Redis Optimization
- Use appropriate TTL values
- Monitor memory usage
- Consider Redis clustering for scale

### Network Efficiency
- Chunked streaming reduces memory usage
- Periodic state updates balance consistency and performance
- Connection pooling for Redis operations

### Client-side
- LocalStorage for stream persistence
- Debounced reconnection attempts
- Efficient content accumulation

## Future Enhancements

1. **Stream Analytics**
   - Detailed metrics collection
   - Performance monitoring
   - Usage patterns analysis

2. **Advanced Features**
   - Stream branching/forking
   - Multi-user stream collaboration
   - Stream templates

3. **Scalability**
   - Redis Cluster support
   - Horizontal scaling
   - Load balancing

## Migration Guide

To migrate from the old streaming system:

1. Update client code to use new API endpoints
2. Replace direct `/api/stream` calls with `/api/stream/start` + `/api/stream/resume`
3. Implement error handling for resumable streams
4. Test stream persistence across page reloads
5. Monitor Redis usage and adjust configuration

The system is backward compatible and can run alongside the old streaming system during migration.