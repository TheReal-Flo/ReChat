import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { StreamManager } from '@/lib/stream-manager'

export async function GET(
  request: NextRequest,
  { params }: { params: { streamId: string } }
) {
  try {
    const { userId } = await auth()
    const { streamId } = params

    if (!streamId) {
      return NextResponse.json(
        { error: 'Stream ID is required' },
        { status: 400 }
      )
    }

    // Validate ownership if user is authenticated
    if (userId && !await StreamManager.validateStreamOwnership(streamId, userId)) {
      return NextResponse.json(
        { error: 'Unauthorized access to stream' },
        { status: 403 }
      )
    }

    // Get stream status
    const status = await StreamManager.getStreamStatus(streamId)
    
    return NextResponse.json(status)

  } catch (error) {
    console.error('Stream status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}