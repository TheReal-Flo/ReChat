import { StreamManager } from './stream-manager'

/**
 * Service for managing stream cleanup operations
 */
export class StreamCleanupService {
  private static cleanupInterval: NodeJS.Timeout | null = null
  private static readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
  
  /**
   * Start the automatic cleanup process
   */
  static startCleanup(): void {
    if (this.cleanupInterval) {
      return // Already running
    }
    
    console.log('[StreamCleanup] Starting automatic cleanup service')
    
    // Run cleanup immediately
    this.runCleanup()
    
    // Schedule periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.runCleanup()
    }, this.CLEANUP_INTERVAL_MS)
  }
  
  /**
   * Stop the automatic cleanup process
   */
  static stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
      console.log('[StreamCleanup] Stopped automatic cleanup service')
    }
  }
  
  /**
   * Run a single cleanup operation
   */
  private static async runCleanup(): Promise<void> {
    try {
      const cleanedCount = await StreamManager.cleanupExpiredStreams()
      if (typeof cleanedCount === 'number' && cleanedCount > 0) {
        console.log(`[StreamCleanup] Cleaned up ${cleanedCount} expired streams`)
      }
    } catch (error) {
      console.error('[StreamCleanup] Error during cleanup:', error)
    }
  }
  
  /**
   * Force cleanup of all expired streams
   */
  static async forceCleanup(): Promise<number> {
    try {
      const cleanedCount = await StreamManager.cleanupExpiredStreams()
      console.log(`[StreamCleanup] Force cleanup completed: ${cleanedCount} streams removed`)
      return typeof cleanedCount === 'number' ? cleanedCount : 0
    } catch (error) {
      console.error('[StreamCleanup] Error during force cleanup:', error)
      throw error
    }
  }
}

// Auto-start cleanup service in production
if (process.env.NODE_ENV === 'production') {
  StreamCleanupService.startCleanup()
}