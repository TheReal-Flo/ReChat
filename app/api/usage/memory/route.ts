import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { UsageTracker } from '@/lib/usage-db'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const requestedUserId = searchParams.get('userId')
    
    // Users can only access their own memory
    if (requestedUserId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const memory = await UsageTracker.getUserMemory(userId)
    
    return NextResponse.json({ memory })
  } catch (error) {
    console.error('Memory GET API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const requestedUserId = body.userId
    
    // Users can only delete their own memory
    if (requestedUserId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Delete user memory by setting it to empty string
    await UsageTracker.setUserMemory(userId, '')
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Memory DELETE API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}