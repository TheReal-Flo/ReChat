# Convex Migration Setup Guide

This guide walks you through migrating from the current PostgreSQL/Redis sync system to Convex for real-time chat synchronization.

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 18+ installed
- Existing chat interface project
- Convex account (sign up at [convex.dev](https://convex.dev))

### 2. Installation

The Convex package has already been installed. If you need to reinstall:

```bash
npm install convex --legacy-peer-deps
```

### 3. Environment Configuration

1. Copy the environment variables from `.env.example`:

```bash
cp .env.example .env.local
```

2. Update your `.env.local` file:

```env
# Convex Configuration
NEXT_PUBLIC_CONVEX_URL=https://your-deployment-url.convex.cloud
NEXT_PUBLIC_USE_CONVEX=false  # Set to true when ready to switch

# Your existing environment variables...
```

### 4. Deploy Convex Functions

1. Initialize and deploy your Convex functions:

```bash
npx convex dev
```

2. This will:
   - Create a new Convex project (if first time)
   - Deploy your schema and functions
   - Provide you with the deployment URL

3. Copy the deployment URL to your `.env.local` file as `NEXT_PUBLIC_CONVEX_URL`

### 5. Test the Setup

1. Start your development server:

```bash
npm run dev
```

2. The app should load normally using the legacy system (since `NEXT_PUBLIC_USE_CONVEX=false`)

3. Check the browser console for the debug indicator showing "Mode: Legacy"

## 📊 Migration Process

### Phase 1: Parallel Testing

1. **Keep using the legacy system** while testing Convex in parallel
2. **Enable Convex mode** temporarily for testing:
   ```env
   NEXT_PUBLIC_USE_CONVEX=true
   ```
3. **Test basic functionality**:
   - Create new chats
   - Send messages
   - Real-time updates
   - Data persistence

### Phase 2: Data Migration

1. **Run the migration script** to transfer existing data:

```bash
# Dry run first (recommended)
npx ts-node scripts/migrate-to-convex.ts YOUR_USER_ID --dry-run

# Actual migration
npx ts-node scripts/migrate-to-convex.ts YOUR_USER_ID

# With custom batch size
npx ts-node scripts/migrate-to-convex.ts YOUR_USER_ID --batch-size=5
```

2. **Verify the migration**:

```bash
# Check migration status
npx ts-node scripts/migrate-to-convex.ts YOUR_USER_ID --status
```

### Phase 3: Switch to Convex

1. **Enable Convex permanently**:
   ```env
   NEXT_PUBLIC_USE_CONVEX=true
   ```

2. **Test thoroughly**:
   - All existing chats should be visible
   - All messages should be preserved
   - Real-time sync should work
   - Multiple browser tabs should sync

3. **Clean up migration fields** (optional):

```bash
npx ts-node scripts/migrate-to-convex.ts YOUR_USER_ID --cleanup
```

### Phase 4: Cleanup (Optional)

Once you're confident Convex is working:

1. **Remove legacy sync code**:
   - `lib/chat-sync.ts`
   - `app/api/sync/route.ts`
   - PostgreSQL/Redis dependencies

2. **Update environment variables**:
   - Remove `DATABASE_URL`
   - Remove `REDIS_URL`
   - Keep `NEXT_PUBLIC_CONVEX_URL`

## 🔧 Configuration Options

### Feature Flags

- `NEXT_PUBLIC_USE_CONVEX`: Toggle between legacy and Convex systems
- `NODE_ENV=development`: Shows debug mode indicator

### Migration Options

- `--dry-run`: Test migration without making changes
- `--batch-size=N`: Process N chats at a time (default: 10)
- `--skip-existing`: Skip chats that already exist in Convex
- `--cleanup`: Remove migration helper fields

## 📁 File Structure

New files added for Convex:

```
convex/
├── schema.ts              # Database schema definition
├── chats.ts              # Chat-related functions
├── messages.ts           # Message-related functions
└── migration.ts          # Migration helper functions

components/
├── providers/
│   └── convex-provider.tsx   # Convex React provider
└── chat/
    └── hybrid-chat-interface.tsx  # Hybrid component

lib/
└── convex-chat-service.ts    # Convex service layer

hooks/
└── use-convex-feature.ts     # Feature flag hook

scripts/
└── migrate-to-convex.ts      # Migration script
```

## 🔍 Troubleshooting

### Common Issues

1. **"Convex URL not found" error**:
   - Ensure `NEXT_PUBLIC_CONVEX_URL` is set in `.env.local`
   - Restart your development server after adding the variable

2. **Migration fails**:
   - Check your user ID is correct
   - Ensure Convex functions are deployed
   - Try with `--dry-run` first

3. **Data not syncing**:
   - Verify `NEXT_PUBLIC_USE_CONVEX=true`
   - Check browser console for errors
   - Ensure you're logged in with Clerk

4. **Performance issues**:
   - Reduce migration batch size: `--batch-size=5`
   - Check Convex dashboard for function logs

### Debug Mode

In development, you'll see a debug indicator in the bottom-right corner showing which mode is active:
- "Mode: Legacy" - Using PostgreSQL/Redis
- "Mode: Convex" - Using Convex

### Logs

Check these locations for debugging:
- Browser console: Client-side errors and sync status
- Convex dashboard: Function execution logs
- Network tab: API calls and responses

## 🎯 Benefits After Migration

### Immediate Benefits
- ✅ **Real-time sync**: Changes appear instantly across all devices
- ✅ **Simplified architecture**: No more PostgreSQL/Redis setup
- ✅ **Automatic scaling**: Convex handles infrastructure
- ✅ **Type safety**: Full TypeScript support
- ✅ **Optimistic updates**: UI updates immediately

### Long-term Benefits
- 🚀 **Faster development**: No database migrations or sync logic
- 🔒 **Built-in security**: Automatic authentication integration
- 📊 **Better monitoring**: Convex dashboard for insights
- 🌐 **Global distribution**: Automatic edge deployment
- 💰 **Cost efficiency**: Pay only for what you use

## 📞 Support

If you encounter issues:

1. Check the [Convex documentation](https://docs.convex.dev)
2. Review the migration logs for specific errors
3. Test with a small dataset first
4. Use the `--dry-run` option to validate before migrating

## 🔄 Rollback Plan

If you need to rollback to the legacy system:

1. Set `NEXT_PUBLIC_USE_CONVEX=false` in your environment
2. Restart your application
3. The app will immediately switch back to PostgreSQL/Redis
4. Your legacy data remains untouched during the migration

This allows for safe testing and gradual migration with minimal risk.