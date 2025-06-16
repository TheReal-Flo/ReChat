import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { ChatSyncService } from '../../../lib/chat-sync'

// GET: Get sync status
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const syncStatus = await ChatSyncService.getSyncStatus(userId)
    
    return NextResponse.json(syncStatus)
  } catch (error: any) {
    console.error('Error getting sync status:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get sync status' },
      { status: 500 }
    )
  }
}

// POST: Trigger manual sync
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get action or direction from request body
    const { direction, action } = await req.json()
    
    // Server-side sync operations should not use IndexedDB
    // Only handle server-side operations here
    if (action === 'auto') {
      // For auto-sync, just update the sync timestamp
      // The actual sync should happen on the client side
      await ChatSyncService.updateSyncTimestamp(userId)
      
      return NextResponse.json({
        message: 'Auto-sync triggered - sync will happen on client side',
        requiresClientSync: true
      })
    } else if (direction === 'server-only') {
      // Only server-side operations that don't require IndexedDB
      const syncStatus = await ChatSyncService.getSyncStatus(userId)
      
      return NextResponse.json({
        message: 'Server sync status updated',
        status: syncStatus
      })
    } else {
      // For client-side sync operations, return instructions
      return NextResponse.json({
        message: 'Sync operations with local storage must be performed on client side',
        requiresClientSync: true,
        direction: direction || 'full'
      })
    }
  } catch (error: any) {
    console.error('Error during sync:', error)
    return NextResponse.json(
      { error: error.message || 'Sync failed' },
      { status: 500 }
    )
  }
}