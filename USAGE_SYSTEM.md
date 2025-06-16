# Usage Limitation System

This document describes the usage limitation system implemented in the chat interface to manage user message quotas.

## Overview

The system implements monthly usage limits for authenticated users:
- **100 messages per month** for all models combined
- **20 messages per month** for premium models (Claude models)
- Limits reset monthly on the 1st of each month
- Unauthenticated users are restricted to `gemini-2.0-flash` model only

## Architecture

### Hybrid Database Approach

1. **PostgreSQL** - Persistent storage for:
   - User monthly usage records
   - Message logs for analytics
   - Long-term data integrity

2. **Redis** - High-performance caching for:
   - Real-time monthly usage counters
   - Rate limiting checks
   - Reduced database load

### Premium Models

Currently designated premium models (Claude family):
- `claude-3.5-sonnet`
- `claude-3-haiku`
- `claude-3-opus`
- `claude-3.7-sonnet`
- `claude-sonnet-4`
- `claude-opus-4`

## Setup Instructions

### 1. Install Dependencies

```bash
npm install pg ioredis
npm install --save-dev @types/pg
```

### 2. Database Setup

#### PostgreSQL

1. Install PostgreSQL locally or use a cloud service
2. Create a database for the application
3. Set the `DATABASE_URL` environment variable

#### Redis

1. Install Redis locally or use a cloud service (Redis Cloud, AWS ElastiCache, etc.)
2. Set the `REDIS_URL` environment variable

### 3. Environment Variables

Add to your `.env.local` file:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/chat_interface
REDIS_URL=redis://localhost:6379

# Optional: Redis password if required
# REDIS_PASSWORD=your_redis_password

# Development/Production Environment
NODE_ENV=development
```

### 4. Database Initialization

The database tables are automatically created when the application starts. The `UsageTracker.initializeDatabase()` method creates:

- `user_usage` table - Stores monthly usage counters
- `message_logs` table - Logs all messages for analytics
- Appropriate indexes for performance

## API Endpoints

### GET /api/usage

Returns current user's usage statistics:

```json
{
  "userId": "user_123",
  "totalMessages": 45,
  "premiumMessages": 12,
  "lastReset": "2024-01-15T00:00:00.000Z",
  "canSendMessage": true,
  "canSendPremiumMessage": true
}
```

### DELETE /api/usage

Resets user's usage counters (admin function).

## Components

### UsageDashboard

A React component that displays:
- Current usage vs limits
- Progress bars with color coding
- Status messages for limit violations
- List of premium models
- Real-time refresh capability

Usage:
```tsx
import { UsageDashboard } from '@/components/UsageDashboard'

function SettingsPage() {
  return (
    <div>
      <UsageDashboard />
    </div>
  )
}
```

## Usage Flow

1. **Request Validation**:
   - User authentication check
   - Model restriction for unauthenticated users
   - Usage limit validation for authenticated users

2. **Usage Check**:
   - Check Redis cache for current usage
   - Fallback to PostgreSQL if cache miss
   - Return 429 status if limits exceeded

3. **Message Processing**:
   - Process the chat request normally
   - Stream response to user

4. **Usage Recording**:
   - Record successful message in PostgreSQL
   - Update Redis cache
   - Log message for analytics

## Error Handling

- **429 Too Many Requests**: Monthly usage limit exceeded
- **403 Forbidden**: Unauthenticated user trying to use premium model
- **401 Unauthorized**: Missing authentication
- **500 Internal Server Error**: Database or system errors

## Performance Considerations

1. **Redis Caching**: Reduces database load by 90%+
2. **Async Usage Recording**: Doesn't block response streaming
3. **Connection Pooling**: PostgreSQL connection pool for efficiency
4. **Indexed Queries**: Optimized database queries with proper indexes

## Monitoring and Analytics

### Usage Analytics

The `getUsageAnalytics()` method provides insights:

```typescript
const analytics = await UsageTracker.getUsageAnalytics(7) // Last 7 days
// Returns: daily message counts, premium usage, active users
```

### Metrics to Monitor

- Monthly active users
- Message volume trends
- Premium model adoption
- Rate limit violations
- System performance

## Scaling Considerations

### High Traffic

1. **Redis Cluster**: For distributed caching
2. **PostgreSQL Read Replicas**: For analytics queries
3. **Connection Pooling**: Optimize database connections
4. **Batch Processing**: For usage analytics

### Cost Optimization

1. **TTL Policies**: Automatic cleanup of old data
2. **Compression**: For large message logs
3. **Archiving**: Move old data to cheaper storage

## Security

1. **User Isolation**: Each user's data is properly isolated
2. **Input Validation**: All inputs are validated
3. **Rate Limiting**: Prevents abuse
4. **Audit Logging**: All usage is logged

## Troubleshooting

### Common Issues

1. **Database Connection Errors**:
   - Check `DATABASE_URL` format
   - Verify PostgreSQL is running
   - Check network connectivity

2. **Redis Connection Errors**:
   - Check `REDIS_URL` format
   - Verify Redis is running
   - Check authentication if required

3. **Usage Not Updating**:
   - Check Redis cache expiration
   - Verify database write permissions
   - Check error logs

### Debug Commands

```bash
# Check PostgreSQL connection
psql $DATABASE_URL -c "SELECT 1;"

# Check Redis connection
redis-cli -u $REDIS_URL ping

# View usage logs
tail -f logs/usage.log
```

## Future Enhancements

1. **Subscription Tiers**: Different limits for paid users
2. **Usage Rollover**: Unused quota carries over
3. **Team Quotas**: Shared limits for organizations
4. **Real-time Notifications**: Usage alerts
5. **Advanced Analytics**: Usage patterns and insights