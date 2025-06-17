/**
 * Script to clear all user data from IndexedDB and localStorage
 * This is useful when you want to start fresh instead of migrating to Convex
 */

import { db } from '../lib/database';

export class DataClearScript {
  /**
   * Clear all chat data from IndexedDB
   */
  static async clearIndexedDB(): Promise<void> {
    try {
      console.log('🗑️  Clearing IndexedDB data...');
      
      // Clear all chats
      const chatCount = await db.chats.count();
      await db.chats.clear();
      console.log(`   ✅ Cleared ${chatCount} chats`);
      
      // Clear all messages
      const messageCount = await db.messages.count();
      await db.messages.clear();
      console.log(`   ✅ Cleared ${messageCount} messages`);
      
      console.log('✅ IndexedDB cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Clear all app-related data from localStorage
   */
  static clearLocalStorage(): void {
    try {
      console.log('🗑️  Clearing localStorage data...');
      
      const keysToRemove = [
        'selectedModel',
        'recentModels',
        'openrouter_api_key',
        'openai_api_key',
        'memory_enabled',
        'sync_settings',
        'currentStreamId'
      ];
      
      let clearedCount = 0;
      keysToRemove.forEach(key => {
        if (localStorage.getItem(key) !== null) {
          localStorage.removeItem(key);
          clearedCount++;
          console.log(`   ✅ Removed: ${key}`);
        }
      });
      
      console.log(`✅ localStorage cleared successfully (${clearedCount} items removed)`);
    } catch (error) {
      console.error('❌ Error clearing localStorage:', error);
      throw error;
    }
  }

  /**
   * Clear all user data (IndexedDB + localStorage)
   */
  static async clearAllData(): Promise<void> {
    console.log('🧹 Starting complete data cleanup...');
    console.log('');
    
    try {
      // Clear IndexedDB
      await this.clearIndexedDB();
      console.log('');
      
      // Clear localStorage
      this.clearLocalStorage();
      console.log('');
      
      console.log('🎉 All user data cleared successfully!');
      console.log('💡 You can now refresh the page to start with a clean slate.');
      console.log('');
      console.log('Note: This only clears local data. If you have server-side data,');
      console.log('you may need to clear that separately or contact your administrator.');
      
    } catch (error) {
      console.error('❌ Data cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Show current data statistics
   */
  static async showDataStats(): Promise<void> {
    try {
      console.log('📊 Current data statistics:');
      
      // IndexedDB stats
      const chatCount = await db.chats.count();
      const messageCount = await db.messages.count();
      console.log(`   📁 Chats: ${chatCount}`);
      console.log(`   💬 Messages: ${messageCount}`);
      
      // localStorage stats
      const localStorageKeys = [
        'selectedModel',
        'recentModels', 
        'openrouter_api_key',
        'openai_api_key',
        'memory_enabled',
        'sync_settings',
        'currentStreamId'
      ];
      
      const existingKeys = localStorageKeys.filter(key => localStorage.getItem(key) !== null);
      console.log(`   🔧 localStorage items: ${existingKeys.length}`);
      if (existingKeys.length > 0) {
        console.log(`      - ${existingKeys.join(', ')}`);
      }
      
    } catch (error) {
      console.error('❌ Error getting data stats:', error);
    }
  }
}

// CLI interface
if (typeof window === 'undefined') {
  // Running in Node.js (command line)
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case '--stats':
      DataClearScript.showDataStats();
      break;
    case '--clear-indexeddb':
      DataClearScript.clearIndexedDB();
      break;
    case '--clear-localstorage':
      DataClearScript.clearLocalStorage();
      break;
    case '--clear-all':
    case undefined:
      DataClearScript.clearAllData();
      break;
    case '--help':
      console.log('Usage: npx ts-node scripts/clear-user-data.ts [options]');
      console.log('');
      console.log('Options:');
      console.log('  --stats              Show current data statistics');
      console.log('  --clear-indexeddb    Clear only IndexedDB data');
      console.log('  --clear-localstorage Clear only localStorage data');
      console.log('  --clear-all          Clear all data (default)');
      console.log('  --help               Show this help message');
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.log('Use --help for usage information');
      process.exit(1);
  }
} else {
  // Running in browser - expose to window for manual use
  (window as any).DataClearScript = DataClearScript;
  console.log('💡 DataClearScript available in browser console');
  console.log('   Usage: DataClearScript.clearAllData()');
}