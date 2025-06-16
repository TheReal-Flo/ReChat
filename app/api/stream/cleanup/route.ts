import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { StreamCleanupService } from '../../../../lib/stream-cleanup'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { action } = body

    if (action === 'force') {
      // Force cleanup of all expired streams
      const cleanedCount = await StreamCleanupService.forceCleanup()
      return NextResponse.json({
        success: true,
        message: `Cleaned up ${cleanedCount} expired streams`,
        cleanedCount
      })
    } else if (action === 'start') {
      // Start automatic cleanup service
      StreamCleanupService.startCleanup()
      return NextResponse.json({
        success: true,
        message: 'Cleanup service started'
      })
    } else if (action === 'stop') {
      // Stop automatic cleanup service
      StreamCleanupService.stopCleanup()
      return NextResponse.json({
        success: true,
        message: 'Cleanup service stopped'
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "force", "start", or "stop"' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Stream cleanup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // Check authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Return cleanup service status
    return NextResponse.json({
      success: true,
      message: 'Cleanup service status retrieved',
      // Note: We can't easily check if the service is running without
      // modifying the StreamCleanupService to track its state
      status: 'unknown'
    })
  } catch (error) {
    console.error('Stream cleanup status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}