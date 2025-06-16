import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { StreamManager } from '@/lib/stream-manager'

export async function DELETE(
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

    // Get stream state to validate ownership
    const streamState = await StreamManager.getStreamState(streamId)
    if (!streamState) {
      return NextResponse.json(
        { error: 'Stream not found or expired' },
        { status: 404 }
      )
    }

    // Validate ownership
    if (userId && !await StreamManager.validateStreamOwnership(streamId, userId)) {
      return NextResponse.json(
        { error: 'Unauthorized access to stream' },
        { status: 403 }
      )
    }

    // Cancel the stream
    await StreamManager.cancelStream(streamId)
    
    return NextResponse.json({
      success: true,
      message: 'Stream cancelled successfully'
    })

  } catch (error) {
    console.error('Stream cancel error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}