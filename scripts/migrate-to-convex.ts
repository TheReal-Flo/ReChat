/**
 * Migration script to transfer data from PostgreSQL/IndexedDB to Convex
 * Run this script after setting up Convex to migrate existing chat data
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { chatService } from "../lib/database";
import { ChatSyncService } from "../lib/chat-sync";

// Initialize Convex client
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface MigrationOptions {
  userId: string;
  batchSize?: number;
  dryRun?: boolean;
  skipExisting?: boolean;
}

interface MigrationResult {
  success: boolean;
  chatsProcessed: number;
  messagesProcessed: number;
  errors: string[];
  duration: number;
}

export class ConvexMigrationScript {
  private static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Main migration function
   */
  static async migrate(options: MigrationOptions): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      success: false,
      chatsProcessed: 0,
      messagesProcessed: 0,
      errors: [],
      duration: 0,
    };

    try {
      console.log('🚀 Starting migration to Convex...');
      console.log(`User ID: ${options.userId}`);
      console.log(`Dry run: ${options.dryRun ? 'Yes' : 'No'}`);
      console.log(`Batch size: ${options.batchSize || 10}`);
      console.log('---');

      // Step 1: Get all chats from local database
      console.log('📂 Fetching chats from local database...');
      const localChats = await chatService.getAllChats();
      console.log(`Found ${localChats.length} chats`);

      if (localChats.length === 0) {
        console.log('✅ No chats to migrate');
        result.success = true;
        return result;
      }

      // Step 2: Check existing data in Convex
      if (options.skipExisting) {
        console.log('🔍 Checking for existing data in Convex...');
        const existingChats = await convex.query(api.chats.getUserChats, {
          userId: options.userId,
        });
        console.log(`Found ${existingChats.length} existing chats in Convex`);
      }

      // Step 3: Migrate chats in batches
      const batchSize = options.batchSize || 10;
      const chatBatches = this.createBatches(localChats, batchSize);

      for (let i = 0; i < chatBatches.length; i++) {
        const batch = chatBatches[i];
        console.log(`📦 Processing chat batch ${i + 1}/${chatBatches.length} (${batch.length} chats)`);

        for (const chat of batch) {
          try {
            if (!options.dryRun) {
              // Create chat in Convex
              const importResult = await convex.mutation(api.migration.importChats, {
                chats: [{
                  originalId: chat.id,
                  userId: options.userId,
                  title: chat.title,
                  parentChatId: chat.parentChatId,
                  branchFromMessageId: chat.branchFromMessageId,
                  branches: chat.branches || [],
                  timestamp: chat.timestamp.getTime(),
                }],
              });

              // Get the Convex chat ID from the import result
              const convexChatId = importResult.chats[0]?.convexId;
              
              if (convexChatId) {
                // Get messages for this chat
                const chatWithMessages = await chatService.getChatById(chat.id);
                const messages = chatWithMessages?.messages || [];

                if (messages.length > 0) {
                  // Migrate messages
                  await convex.mutation(api.migration.importMessages, {
                    messages: messages.map((msg: any) => ({
                      originalId: msg.id,
                      chatId: convexChatId,
                      userId: options.userId,
                      content: msg.content,
                      role: msg.role as "user" | "assistant",
                      position: msg.position || 0,
                      attachments: msg.attachments,
                      timestamp: msg.timestamp.getTime(),
                    })),
                  });

                  result.messagesProcessed += messages.length;
                }
              }
            }

            result.chatsProcessed++;
            console.log(`  ✅ Migrated chat: ${chat.title} (${chat.messages?.length || 0} messages)`);
          } catch (error) {
            const errorMsg = `Failed to migrate chat ${chat.id}: ${error}`;
            console.error(`  ❌ ${errorMsg}`);
            result.errors.push(errorMsg);
          }
        }

        // Add delay between batches to avoid rate limiting
        if (i < chatBatches.length - 1) {
          await this.delay(1000);
        }
      }

      // Step 4: Verify migration
      if (!options.dryRun) {
        console.log('🔍 Verifying migration...');
        const migrationStatus = await convex.query(api.migration.getMigrationStatus, {});
        console.log(`Verification: ${migrationStatus.chats.total} chats, ${migrationStatus.messages.total} messages`);
      }

      result.success = result.errors.length === 0;
      result.duration = Date.now() - startTime;

      console.log('---');
      console.log('🎉 Migration completed!');
      console.log(`✅ Chats processed: ${result.chatsProcessed}`);
      console.log(`✅ Messages processed: ${result.messagesProcessed}`);
      console.log(`❌ Errors: ${result.errors.length}`);
      console.log(`⏱️ Duration: ${Math.round(result.duration / 1000)}s`);

      if (result.errors.length > 0) {
        console.log('\n❌ Errors encountered:');
        result.errors.forEach(error => console.log(`  - ${error}`));
      }

      return result;
    } catch (error) {
      result.errors.push(`Migration failed: ${error}`);
      result.duration = Date.now() - startTime;
      console.error('💥 Migration failed:', error);
      return result;
    }
  }

  /**
   * Clean up migration fields after successful migration
   */
  static async cleanupMigrationFields(userId: string): Promise<void> {
    console.log('🧹 Cleaning up migration fields...');
    await convex.mutation(api.migration.cleanupMigrationFields, {});
    console.log('✅ Migration fields cleaned up');
  }

  /**
   * Verify data integrity after migration
   */
  static async verifyDataIntegrity(userId: string): Promise<boolean> {
    console.log('🔍 Verifying data integrity...');
    const result = await convex.query(api.migration.verifyDataIntegrity, {});
    
    if (result.issues.length === 0) {
      console.log('✅ Data integrity verification passed');
    } else {
      console.error('❌ Data integrity verification failed:', result.issues);
    }
    
    return result.issues.length === 0;
  }

  /**
   * Create batches from an array
   */
  private static createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Get migration status
   */
  static async getMigrationStatus(userId: string) {
    return await convex.query(api.migration.getMigrationStatus, {});
  }
}

// CLI interface for running the migration
if (require.main === module) {
  const args = process.argv.slice(2);
  const userId = args[0];
  const dryRun = args.includes('--dry-run');
  const batchSize = parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '10');
  const skipExisting = args.includes('--skip-existing');

  if (!userId) {
    console.error('Usage: npx ts-node scripts/migrate-to-convex.ts <userId> [--dry-run] [--batch-size=10] [--skip-existing]');
    process.exit(1);
  }

  ConvexMigrationScript.migrate({
    userId,
    dryRun,
    batchSize,
    skipExisting,
  }).then(result => {
    process.exit(result.success ? 0 : 1);
  }).catch(error => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
}